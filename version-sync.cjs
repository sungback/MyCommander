const fs = require('fs');
const path = require('path');

/**
 * 이 스크립트는 package.json의 버전을 src-tauri/tauri.conf.json에 동기화합니다.
 * npm version 명령어 실행 시 자동으로 호출되도록 설정되었습니다.
 */

try {
  // 1. package.json에서 새 버전 읽기
  const pkgPath = path.join(__dirname, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const newVersion = pkg.version;

  // 2. tauri.conf.json 경로 설정
  const tauriConfPath = path.join(__dirname, 'src-tauri', 'tauri.conf.json');
  
  if (!fs.existsSync(tauriConfPath)) {
    console.error('❌ src-tauri/tauri.conf.json 파일을 찾을 수 없습니다.');
    process.exit(1);
  }

  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));

  // 3. 버전 업데이트 (Tauri v2 기준 top-level version)
  tauriConf.version = newVersion;

  // 4. 파일 저장
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  
  console.log(`✅ Tauri version successfully synced to ${newVersion}`);
} catch (error) {
  console.error('❌ 버전 동기화 중 오류 발생:', error);
  process.exit(1);
}
