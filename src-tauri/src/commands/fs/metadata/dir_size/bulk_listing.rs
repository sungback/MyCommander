//! macOS `getattrlistbulk`로 디렉터리 항목과 메타데이터를 한 번에 읽는다.
//! `read_dir` + 항목마다 `fstatat` 대신 디렉터리마다 일괄 조회해 시스템 호출 수를 줄인다
//! (2026-10-18 측정: warm 기준 1.2~1.5배. 크기 계획서 2단계 참고).
//! `unsafe`는 시스템 호출 두 곳(open, getattrlistbulk)과 close에만 두고, 응답 버퍼는 범위를 검사하며 읽는다.

use std::cell::RefCell;
use std::ffi::CString;
use std::io;
use std::ops::ControlFlow;
use std::os::unix::ffi::OsStrExt;
use std::path::Path;

use libc::c_void;

/// libc 0.2.183에 없는 상수. `<sys/attr.h>`와 `<sys/vnode.h>`의 값이다.
const ATTR_CMN_ERROR: u32 = 0x2000_0000;
const VREG: u32 = 1;
const VDIR: u32 = 2;
/// 호출 한 번에 받을 응답 버퍼 크기. 작업 스레드마다 하나씩 재사용한다.
const BUFFER_SIZE: usize = 256 * 1024;

#[derive(Debug, PartialEq, Eq)]
pub(super) enum BulkEntryKind {
    File {
        /// 겉보기 크기(`st_size`와 같음)
        len: u64,
        /// 실제 할당 크기(sparse 파일 판별용)
        allocated: u64,
        link_count: u32,
        dev: u64,
        file_id: u64,
    },
    Dir {
        dev: u64,
        is_mount_point: bool,
    },
    /// 심볼릭 링크, 장치 파일 등. 크기를 세지 않고 내려가지도 않는다.
    Other,
}

pub(super) struct BulkEntry<'a> {
    /// 끝의 NUL을 뺀 이름
    pub name: &'a [u8],
    /// 이 항목의 속성을 읽지 못했을 때의 errno
    pub error: Option<i32>,
    pub kind: BulkEntryKind,
}

struct DirFd(libc::c_int);

impl Drop for DirFd {
    fn drop(&mut self) {
        // SAFETY: open이 돌려준 유효한 fd를 한 번만 닫는다.
        unsafe {
            libc::close(self.0);
        }
    }
}

thread_local! {
    static BUFFER: RefCell<Vec<u8>> = RefCell::new(vec![0; BUFFER_SIZE]);
}

/// 응답 버퍼를 앞에서부터 읽는다. 속성은 4바이트 경계에 붙어 있어 8바이트 값도 정렬되지 않을 수 있다.
struct Cursor<'a> {
    bytes: &'a [u8],
    pos: usize,
}

impl Cursor<'_> {
    fn u32(&mut self) -> Option<u32> {
        let value = self.bytes.get(self.pos..self.pos.checked_add(4)?)?;
        self.pos += 4;
        Some(u32::from_ne_bytes(value.try_into().ok()?))
    }

    fn u64(&mut self) -> Option<u64> {
        let value = self.bytes.get(self.pos..self.pos.checked_add(8)?)?;
        self.pos += 8;
        Some(u64::from_ne_bytes(value.try_into().ok()?))
    }
}

fn malformed_entry() -> io::Error {
    io::Error::new(
        io::ErrorKind::InvalidData,
        "malformed getattrlistbulk entry",
    )
}

/// `dev_t`(i32)를 `MetadataExt::dev()`와 같은 방식으로 u64로 바꾼다.
fn dev_to_u64(dev: u32) -> u64 {
    dev as i32 as u64
}

/// 항목 하나를 해석한다. 순서는 길이, 돌려준 속성 집합, `ATTR_CMN_ERROR`(있으면), 나머지 공통 속성(비트 순),
/// 디렉터리 속성, 파일 속성이다. 해당하지 않는 속성(파일의 디렉터리 속성 등)은 버퍼에 없다.
fn parse_entry(bytes: &[u8]) -> Option<BulkEntry<'_>> {
    let mut cursor = Cursor { bytes, pos: 4 };
    let common = cursor.u32()?;
    let _volume = cursor.u32()?;
    let dir = cursor.u32()?;
    let file = cursor.u32()?;
    let _fork = cursor.u32()?;

    let error = if common & ATTR_CMN_ERROR != 0 {
        Some(cursor.u32()? as i32).filter(|errno| *errno != 0)
    } else {
        None
    };

    let mut name: &[u8] = &[];
    if common & libc::ATTR_CMN_NAME != 0 {
        // attrreference_t: 이 구조체 위치 기준의 데이터 오프셋(i32)과 NUL을 포함한 길이(u32)
        let reference_pos = cursor.pos;
        let data_offset = cursor.u32()? as i32;
        let length = cursor.u32()? as usize;
        let start =
            usize::try_from(i64::try_from(reference_pos).ok()? + i64::from(data_offset)).ok()?;
        let raw = bytes.get(start..start.checked_add(length)?)?;
        name = raw.strip_suffix(&[0]).unwrap_or(raw);
    }
    let dev = if common & libc::ATTR_CMN_DEVID != 0 {
        dev_to_u64(cursor.u32()?)
    } else {
        0
    };
    let object_type = if common & libc::ATTR_CMN_OBJTYPE != 0 {
        cursor.u32()?
    } else {
        0
    };
    let file_id = if common & libc::ATTR_CMN_FILEID != 0 {
        cursor.u64()?
    } else {
        0
    };
    let mount_status = if dir & libc::ATTR_DIR_MOUNTSTATUS != 0 {
        cursor.u32()?
    } else {
        0
    };
    let link_count = if file & libc::ATTR_FILE_LINKCOUNT != 0 {
        cursor.u32()?
    } else {
        1
    };
    let allocated = if file & libc::ATTR_FILE_ALLOCSIZE != 0 {
        cursor.u64()?
    } else {
        0
    };
    let len = if file & libc::ATTR_FILE_DATALENGTH != 0 {
        cursor.u64()?
    } else {
        0
    };

    let kind = match object_type {
        VREG => BulkEntryKind::File {
            len,
            allocated,
            link_count,
            dev,
            file_id,
        },
        VDIR => BulkEntryKind::Dir {
            dev,
            is_mount_point: mount_status & libc::DIR_MNTSTATUS_MNTPOINT != 0,
        },
        _ => BulkEntryKind::Other,
    };
    Some(BulkEntry { name, error, kind })
}

/// 일괄 조회를 지원하지 않는 파일시스템이 돌려주는 오류면 true. 호출자는 `read_dir`로 다시 읽는다.
pub(super) fn is_unsupported_error(error: &io::Error) -> bool {
    matches!(
        error.raw_os_error(),
        Some(libc::ENOTSUP | libc::EINVAL | libc::ENOSYS)
    )
}

/// `path`의 항목을 하나씩 `visit`에 넘긴다(`.`과 `..`은 없다). `visit`이 `Break`를 돌려주면 멈추고 `Break`를 돌려준다.
/// 디렉터리를 열지 못하거나 조회 중 오류가 나면 그때까지 넘긴 항목은 그대로 두고 오류를 돌려준다.
pub(super) fn list_directory(
    path: &Path,
    mut visit: impl FnMut(BulkEntry<'_>) -> ControlFlow<()>,
) -> io::Result<ControlFlow<()>> {
    let c_path = CString::new(path.as_os_str().as_bytes())?;
    // SAFETY: c_path는 NUL로 끝나는 유효한 C 문자열이다.
    let fd = unsafe {
        libc::open(
            c_path.as_ptr(),
            libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC,
        )
    };
    if fd < 0 {
        return Err(io::Error::last_os_error());
    }
    let fd = DirFd(fd);

    let mut attributes = libc::attrlist {
        bitmapcount: libc::ATTR_BIT_MAP_COUNT,
        reserved: 0,
        commonattr: libc::ATTR_CMN_RETURNED_ATTRS
            | libc::ATTR_CMN_NAME
            | ATTR_CMN_ERROR
            | libc::ATTR_CMN_DEVID
            | libc::ATTR_CMN_OBJTYPE
            | libc::ATTR_CMN_FILEID,
        volattr: 0,
        dirattr: libc::ATTR_DIR_MOUNTSTATUS,
        fileattr: libc::ATTR_FILE_LINKCOUNT
            | libc::ATTR_FILE_ALLOCSIZE
            | libc::ATTR_FILE_DATALENGTH,
        forkattr: 0,
    };

    BUFFER.with(|buffer| {
        let mut buffer = buffer.borrow_mut();
        loop {
            // SAFETY: fd는 열린 디렉터리이고, attributes와 buffer는 호출 동안 유효하며 buffer 크기를 함께 넘긴다.
            let count = unsafe {
                libc::getattrlistbulk(
                    fd.0,
                    (&mut attributes as *mut libc::attrlist).cast::<c_void>(),
                    buffer.as_mut_ptr().cast::<c_void>(),
                    buffer.len(),
                    0,
                )
            };
            if count < 0 {
                return Err(io::Error::last_os_error());
            }
            if count == 0 {
                return Ok(ControlFlow::Continue(()));
            }

            let mut offset = 0_usize;
            for _ in 0..count {
                let rest = buffer.get(offset..).ok_or_else(malformed_entry)?;
                let length = rest
                    .get(..4)
                    .and_then(|bytes| bytes.try_into().ok())
                    .map(|bytes: [u8; 4]| u32::from_ne_bytes(bytes) as usize)
                    .filter(|length| *length >= 4)
                    .ok_or_else(malformed_entry)?;
                let entry = rest
                    .get(..length)
                    .and_then(parse_entry)
                    .ok_or_else(malformed_entry)?;
                if visit(entry).is_break() {
                    return Ok(ControlFlow::Break(()));
                }
                offset += length;
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::{list_directory, BulkEntryKind};
    use std::collections::BTreeMap;
    use std::fs;
    use std::ops::ControlFlow;
    use std::os::unix::fs::{symlink, MetadataExt};
    use std::path::PathBuf;

    fn make_temp_dir(name: &str) -> PathBuf {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("mycommander-bulk-{name}-{unique}"));
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn lists_entries_with_the_same_metadata_as_stat() {
        let root = make_temp_dir("metadata");
        fs::write(root.join("file.bin"), [7_u8; 1234]).unwrap();
        fs::hard_link(root.join("file.bin"), root.join("link.bin")).unwrap();
        fs::create_dir(root.join("child")).unwrap();
        symlink(root.join("file.bin"), root.join("symlink")).unwrap();
        fs::write(root.join("이름 공백.txt"), b"hi").unwrap();

        let mut entries = BTreeMap::new();
        let outcome = list_directory(&root, |entry| {
            assert!(entry.error.is_none());
            entries.insert(String::from_utf8(entry.name.to_vec()).unwrap(), entry.kind);
            ControlFlow::Continue(())
        })
        .unwrap();

        assert_eq!(outcome, ControlFlow::Continue(()));
        assert_eq!(
            entries.keys().collect::<Vec<_>>(),
            ["child", "file.bin", "link.bin", "symlink", "이름 공백.txt"]
        );
        let file = fs::symlink_metadata(root.join("file.bin")).unwrap();
        assert_eq!(
            entries["file.bin"],
            BulkEntryKind::File {
                len: 1234,
                allocated: file.blocks() * 512,
                link_count: 2,
                dev: file.dev(),
                file_id: file.ino(),
            }
        );
        assert_eq!(
            entries["child"],
            BulkEntryKind::Dir {
                dev: file.dev(),
                is_mount_point: false,
            }
        );
        assert_eq!(entries["symlink"], BulkEntryKind::Other);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn lists_more_entries_than_fit_in_one_buffer() {
        let root = make_temp_dir("many");
        // 이름이 길어 256 KiB 버퍼를 여러 번 채운다.
        let names: Vec<String> = (0..3000).map(|index| format!("{index:0>200}")).collect();
        for name in &names {
            fs::write(root.join(name), b"x").unwrap();
        }

        let mut count = 0;
        let outcome = list_directory(&root, |entry| {
            assert_eq!(entry.name.len(), 200);
            count += 1;
            ControlFlow::Continue(())
        })
        .unwrap();

        assert_eq!(outcome, ControlFlow::Continue(()));
        assert_eq!(count, names.len());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn stops_when_visit_breaks() {
        let root = make_temp_dir("break");
        for index in 0..10 {
            fs::write(root.join(format!("{index}")), b"x").unwrap();
        }

        let mut count = 0;
        let outcome = list_directory(&root, |_| {
            count += 1;
            ControlFlow::Break(())
        })
        .unwrap();

        assert_eq!(outcome, ControlFlow::Break(()));
        assert_eq!(count, 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_missing_directory_as_not_found() {
        let error = list_directory(
            &std::env::temp_dir().join("mycommander-bulk-missing"),
            |_| ControlFlow::Continue(()),
        )
        .unwrap_err();

        assert_eq!(error.kind(), std::io::ErrorKind::NotFound);
    }
}
