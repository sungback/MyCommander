use std::collections::{HashMap, HashSet};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex, MutexGuard,
};

use tokio::sync::{watch, Notify};

use super::scan::{ScanProgress, SCAN_CANCELLED_MESSAGE};
use super::types::DirectorySizeScanResult;

type ScanOutcome = Result<DirectorySizeScanResult, String>;

/// 한 경로에 대해 실제로 돌고 있는 계산 하나. 같은 경로를 요청한 scan_id들이 결과를 함께 받는다.
struct SharedScan {
    /// 같은 경로의 이전 계산과 구분하는 번호. 끝난 계산이 새 계산의 기록을 지우지 않게 한다.
    generation: u64,
    cancel_flag: Arc<AtomicBool>,
    subscribers: HashSet<String>,
    result_rx: watch::Receiver<Option<ScanOutcome>>,
}

struct Subscriber {
    path: String,
    generation: u64,
    cancelled: Arc<Notify>,
}

#[derive(Default)]
struct ScanRegistry {
    scans_by_path: HashMap<String, SharedScan>,
    subscribers: HashMap<String, Subscriber>,
    next_generation: u64,
}

/// 새 계산을 시작해야 하는 첫 요청자에게만 주어진다.
struct ScanLeader {
    generation: u64,
    cancel_flag: Arc<AtomicBool>,
    result_tx: watch::Sender<Option<ScanOutcome>>,
}

struct ScanTicket {
    leader: Option<ScanLeader>,
    cancelled: Arc<Notify>,
    result_rx: watch::Receiver<Option<ScanOutcome>>,
}

/// 진행 중인 폴더 크기 계산을 경로 기준으로 공유한다.
/// 같은 경로를 여러 scan_id가 요청하면 계산은 한 번만 돌고, 모든 요청자가 진행 이벤트와 결과를 받는다.
/// 계산은 마지막 요청자까지 취소했을 때만 멈춘다.
#[derive(Clone, Default)]
pub struct DirSizeScanState {
    registry: Arc<Mutex<ScanRegistry>>,
}

impl DirSizeScanState {
    fn lock(&self) -> Result<MutexGuard<'_, ScanRegistry>, String> {
        self.registry
            .lock()
            .map_err(|_| "Directory size scan state is unavailable".to_string())
    }

    /// 요청을 등록한다. 같은 경로의 살아 있는 계산이 있으면 합류하고, 없으면 새 계산의 leader가 된다.
    fn join(&self, path: &str, scan_id: &str) -> Result<ScanTicket, String> {
        let mut registry = self.lock()?;
        if registry.subscribers.contains_key(scan_id) {
            return Err(format!("Directory size scan `{scan_id}` is already active"));
        }

        // 모든 요청자가 취소해 멈추는 중인 계산에는 합류하지 않고 새로 시작한다.
        let running = registry
            .scans_by_path
            .get(path)
            .filter(|scan| !scan.cancel_flag.load(Ordering::SeqCst))
            .map(|scan| (scan.generation, scan.result_rx.clone()));

        let (generation, result_rx, leader) = match running {
            Some((generation, result_rx)) => (generation, result_rx, None),
            None => {
                let generation = registry.next_generation;
                registry.next_generation = registry.next_generation.wrapping_add(1);
                let cancel_flag = Arc::new(AtomicBool::new(false));
                let (result_tx, result_rx) = watch::channel(None);
                registry.scans_by_path.insert(
                    path.to_string(),
                    SharedScan {
                        generation,
                        cancel_flag: cancel_flag.clone(),
                        subscribers: HashSet::new(),
                        result_rx: result_rx.clone(),
                    },
                );
                let leader = ScanLeader {
                    generation,
                    cancel_flag,
                    result_tx,
                };
                (generation, result_rx, Some(leader))
            }
        };

        if let Some(scan) = registry.scans_by_path.get_mut(path) {
            scan.subscribers.insert(scan_id.to_string());
        }
        let cancelled = Arc::new(Notify::new());
        registry.subscribers.insert(
            scan_id.to_string(),
            Subscriber {
                path: path.to_string(),
                generation,
                cancelled: cancelled.clone(),
            },
        );

        Ok(ScanTicket {
            leader,
            cancelled,
            result_rx,
        })
    }

    /// 요청자를 제거한다. 남은 요청자가 없으면 계산을 멈춘다.
    fn leave(&self, scan_id: &str) {
        let Ok(mut registry) = self.registry.lock() else {
            return;
        };
        let Some(subscriber) = registry.subscribers.remove(scan_id) else {
            return;
        };

        if let Some(scan) = registry
            .scans_by_path
            .get_mut(&subscriber.path)
            .filter(|scan| scan.generation == subscriber.generation)
        {
            scan.subscribers.remove(scan_id);
            if scan.subscribers.is_empty() {
                scan.cancel_flag.store(true, Ordering::SeqCst);
            }
        }
    }

    /// 계산이 끝났을 때 경로 기록을 지운다. 이후 요청은 새 계산을 시작한다.
    fn finish(&self, path: &str, generation: u64) {
        if let Ok(mut registry) = self.registry.lock() {
            if registry
                .scans_by_path
                .get(path)
                .is_some_and(|scan| scan.generation == generation)
            {
                registry.scans_by_path.remove(path);
            }
        }
    }

    fn subscriber_ids(&self, path: &str, generation: u64) -> Vec<String> {
        self.registry
            .lock()
            .ok()
            .and_then(|registry| {
                registry
                    .scans_by_path
                    .get(path)
                    .filter(|scan| scan.generation == generation)
                    .map(|scan| scan.subscribers.iter().cloned().collect())
            })
            .unwrap_or_default()
    }

    /// 이 scan_id의 대기만 취소한다. 같은 경로를 기다리는 다른 요청자가 있으면 계산은 계속된다.
    pub fn cancel(&self, scan_id: &str) -> bool {
        let cancelled = self.registry.lock().ok().and_then(|registry| {
            registry
                .subscribers
                .get(scan_id)
                .map(|subscriber| subscriber.cancelled.clone())
        });

        match cancelled {
            Some(cancelled) => {
                cancelled.notify_one();
                self.leave(scan_id);
                true
            }
            None => false,
        }
    }
}

/// `scan_id` 요청을 같은 경로의 진행 중인 계산에 합류시키거나 새 계산을 시작하고, 결과를 기다린다.
/// `scan`은 실제 계산 함수이고, `emit`은 (scan_id, path, 진행 상황)마다 호출된다.
pub(super) async fn run_shared_scan<S, E>(
    state: DirSizeScanState,
    path: String,
    scan_id: String,
    scan: S,
    emit: E,
) -> ScanOutcome
where
    S: FnOnce(&str, &AtomicBool, &mut dyn FnMut(ScanProgress)) -> ScanOutcome + Send + 'static,
    E: Fn(&str, &str, ScanProgress) + Send + 'static,
{
    let ticket = state.join(&path, &scan_id)?;
    if let Some(leader) = ticket.leader {
        tokio::spawn(run_leader(state.clone(), path, leader, scan, emit));
    }

    let outcome = wait_for_outcome(ticket.result_rx, &ticket.cancelled).await;
    state.leave(&scan_id);
    outcome
}

async fn run_leader<S, E>(
    state: DirSizeScanState,
    path: String,
    leader: ScanLeader,
    scan: S,
    emit: E,
) where
    S: FnOnce(&str, &AtomicBool, &mut dyn FnMut(ScanProgress)) -> ScanOutcome + Send + 'static,
    E: Fn(&str, &str, ScanProgress) + Send + 'static,
{
    let ScanLeader {
        generation,
        cancel_flag,
        result_tx,
    } = leader;

    let outcome = tokio::task::spawn_blocking({
        let state = state.clone();
        let path = path.clone();
        move || {
            // 진행 이벤트는 현재 기다리는 모든 scan_id 앞으로 보낸다(프런트엔드는 scanId로 이벤트를 거른다).
            let mut emit_progress = |progress: ScanProgress| {
                for scan_id in state.subscriber_ids(&path, generation) {
                    emit(&scan_id, &path, progress);
                }
            };
            scan(&path, &cancel_flag, &mut emit_progress)
        }
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|outcome| outcome);

    // 기록을 먼저 지워, 결과를 보낸 뒤 들어온 요청이 끝난 계산에 합류하지 않게 한다.
    state.finish(&path, generation);
    let _ = result_tx.send(Some(outcome));
}

async fn wait_for_outcome(
    mut result_rx: watch::Receiver<Option<ScanOutcome>>,
    cancelled: &Notify,
) -> ScanOutcome {
    tokio::select! {
        biased;
        _ = cancelled.notified() => Err(SCAN_CANCELLED_MESSAGE.to_string()),
        outcome = result_rx.wait_for(Option::is_some) => match outcome {
            Ok(outcome) => (*outcome)
                .clone()
                .unwrap_or_else(|| Err("Directory size scan ended without a result".to_string())),
            Err(_) => Err("Directory size scan ended without a result".to_string()),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    fn result_with_size(size: u64) -> DirectorySizeScanResult {
        DirectorySizeScanResult {
            size,
            is_partial: false,
            scanned_entries: 1,
            error_count: 0,
            inaccessible_count: 0,
            started_at_ms: 1_000,
        }
    }

    fn cancel_flag_of(state: &DirSizeScanState, path: &str) -> Option<bool> {
        state
            .registry
            .lock()
            .unwrap()
            .scans_by_path
            .get(path)
            .map(|scan| scan.cancel_flag.load(Ordering::SeqCst))
    }

    #[test]
    fn join_shares_running_scan_for_same_path() {
        let state = DirSizeScanState::default();

        let first = state.join("/data", "a").unwrap();
        let second = state.join("/data", "b").unwrap();
        let other_path = state.join("/other", "c").unwrap();

        assert!(first.leader.is_some());
        assert!(second.leader.is_none());
        assert!(other_path.leader.is_some());
        let mut ids = state.subscriber_ids("/data", 0);
        ids.sort();
        assert_eq!(ids, vec!["a".to_string(), "b".to_string()]);
    }

    #[test]
    fn join_rejects_duplicate_scan_id() {
        let state = DirSizeScanState::default();
        let _ticket = state.join("/data", "a").unwrap();

        assert!(state.join("/other", "a").is_err());
    }

    #[test]
    fn scan_stops_only_after_last_subscriber_leaves() {
        let state = DirSizeScanState::default();
        let _first = state.join("/data", "a").unwrap();
        let _second = state.join("/data", "b").unwrap();

        assert!(state.cancel("a"));
        assert_eq!(cancel_flag_of(&state, "/data"), Some(false));

        assert!(state.cancel("b"));
        assert_eq!(cancel_flag_of(&state, "/data"), Some(true));
        assert!(!state.cancel("b"));
    }

    #[test]
    fn join_after_all_cancelled_starts_new_scan() {
        let state = DirSizeScanState::default();
        let _first = state.join("/data", "a").unwrap();
        state.cancel("a");

        let next = state.join("/data", "b").unwrap();
        let next_leader = next.leader.as_ref().unwrap();

        assert_eq!(next_leader.generation, 1);
        assert_eq!(cancel_flag_of(&state, "/data"), Some(false));
        // 멈추는 중인 이전 계산이 끝나도 새 계산의 기록은 남아 있어야 한다.
        state.finish("/data", 0);
        assert_eq!(state.subscriber_ids("/data", 1), vec!["b".to_string()]);
    }

    #[tokio::test]
    async fn follower_receives_result_after_leader_cancels() {
        let state = DirSizeScanState::default();
        let (release_tx, release_rx) = mpsc::channel::<()>();
        let (started_tx, started_rx) = tokio::sync::oneshot::channel::<()>();

        let leader = tokio::spawn(run_shared_scan(
            state.clone(),
            "/data".to_string(),
            "leader".to_string(),
            move |_path: &str, cancel_flag: &AtomicBool, _emit: &mut dyn FnMut(ScanProgress)| {
                let _ = started_tx.send(());
                release_rx.recv().unwrap();
                if cancel_flag.load(Ordering::SeqCst) {
                    return Err(SCAN_CANCELLED_MESSAGE.to_string());
                }
                Ok(result_with_size(42))
            },
            |_: &str, _: &str, _: ScanProgress| {},
        ));
        started_rx.await.unwrap();

        let follower = tokio::spawn(run_shared_scan(
            state.clone(),
            "/data".to_string(),
            "follower".to_string(),
            |_: &str, _: &AtomicBool, _: &mut dyn FnMut(ScanProgress)| -> ScanOutcome {
                panic!("follower must not start a second scan")
            },
            |_: &str, _: &str, _: ScanProgress| {},
        ));
        // 합류가 끝날 때까지 기다린다.
        while state.subscriber_ids("/data", 0).len() < 2 {
            tokio::time::sleep(Duration::from_millis(5)).await;
        }

        assert!(state.cancel("leader"));
        assert_eq!(leader.await.unwrap().unwrap_err(), SCAN_CANCELLED_MESSAGE);

        release_tx.send(()).unwrap();
        // 늦게 합류한 요청도 leader가 스캔을 시작한 시각을 그대로 받는다.
        assert_eq!(follower.await.unwrap().unwrap(), result_with_size(42));
        assert!(state.subscriber_ids("/data", 0).is_empty());
    }
}
