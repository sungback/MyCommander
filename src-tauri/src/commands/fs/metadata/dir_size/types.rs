use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeEstimate {
    pub size: u64,
    pub is_partial: bool,
    pub scanned_entries: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeScanResult {
    pub size: u64,
    pub is_partial: bool,
    pub scanned_entries: usize,
    pub error_count: usize,
    /// 권한이 없어 읽지 못한 항목 수. 0보다 크면 `size`는 하한값이다.
    pub inaccessible_count: usize,
    /// 스캔을 실제로 시작한 시각(Unix ms). 진행 중인 스캔에 나중에 합류한 요청도 이 값으로
    /// 스캔 도중 생긴 파일 변경을 판단한다.
    pub started_at_ms: u64,
    /// 스캔하며 함께 구한 하위 폴더 결과(깊이 1~2, 큰 폴더부터 최대 2,000개). 취소되면 비어 있다.
    pub children: Vec<DirectorySizeChild>,
}

/// 하위 폴더 하나의 결과. 그 폴더만 따로 계산했을 때와 같은 값이다.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeChild {
    pub path: String,
    pub size: u64,
    pub is_partial: bool,
    pub inaccessible_count: usize,
    /// 스캔 루트로부터의 깊이(바로 아래가 1)
    pub depth: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySizeProgress {
    pub scan_id: String,
    pub path: String,
    pub size: u64,
    pub is_partial: bool,
    pub scanned_entries: usize,
    pub completed: bool,
}
