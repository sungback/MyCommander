# move_to_trash & __unresolved__::ref::delete
Cohesion: 0.40 | Nodes: 5

## Key Nodes
- **move_to_trash** (/Users/sungback/Documents/MyCommander/src-tauri/src/commands/fs_commands.rs) -- 5 connections
  - -> calls -> [[unresolvedreftrashtrashcontextnew]]
  - -> calls -> [[unresolvedrefsetdeletemethod]]
  - -> calls -> [[unresolvedrefdelete]]
  - -> calls -> [[unresolvedreftrashdelete]]
  - <- contains <- [[fscommands]]
- **__unresolved__::ref::delete** () -- 1 connections
  - <- calls <- [[movetotrash]]
- **__unresolved__::ref::set_delete_method** () -- 1 connections
  - <- calls <- [[movetotrash]]
- **__unresolved__::ref::trash__delete** () -- 1 connections
  - <- calls <- [[movetotrash]]
- **__unresolved__::ref::trash__trashcontext__new** () -- 1 connections
  - <- calls <- [[movetotrash]]

## Internal Relationships
- move_to_trash -> calls -> __unresolved__::ref::trash__trashcontext__new [EXTRACTED]
- move_to_trash -> calls -> __unresolved__::ref::set_delete_method [EXTRACTED]
- move_to_trash -> calls -> __unresolved__::ref::delete [EXTRACTED]
- move_to_trash -> calls -> __unresolved__::ref::trash__delete [EXTRACTED]

## Cross-Community Connections

## Context
이 커뮤니티는 move_to_trash, __unresolved__::ref::delete, __unresolved__::ref::set_delete_method를 중심으로 calls 관계로 연결되어 있다. 주요 소스 파일은 fs_commands.rs이다.

### Key Facts
- for path in paths { let p = Path::new(&path); if permanent { if p.is_dir() { fs::remove_dir_all(p).map_err(|e| e.to_string())?; } else { fs::remove_file(p).map_err(|e| e.to_string())?; } } else { move_to_trash(p).map_err(|e| e.to_string())?; } } Ok(()) }
