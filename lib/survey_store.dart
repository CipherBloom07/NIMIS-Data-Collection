import 'dart:convert';
import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

class SurveyDraft {
  const SurveyDraft({required this.id, required this.answers, required this.revision, required this.modifiedAt});
  final String id;
  final Map<String, dynamic> answers;
  final int revision;
  final DateTime modifiedAt;
}

class SurveyStore {
  SurveyStore._(this.db);
  final Database db;
  static Future<SurveyStore> open() async {
    final root=await getDatabasesPath();
    final database=await openDatabase(p.join(root,'nimis_field_collector.db'), version:1,
      onCreate:(db,version) async {
        await db.execute('CREATE TABLE surveys (id TEXT PRIMARY KEY, answers TEXT NOT NULL, revision INTEGER NOT NULL, modified_at TEXT NOT NULL)');
        await db.execute('CREATE TABLE outbox (survey_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, event_id TEXT NOT NULL, payload TEXT NOT NULL)');
      });
    return SurveyStore._(database);
  }
  Future<List<SurveyDraft>> all() async {
    final rows=await db.query('surveys',orderBy:'modified_at DESC');
    return rows.map((row)=>SurveyDraft(
      id:row['id'] as String,
      answers:Map<String,dynamic>.from(jsonDecode(row['answers'] as String) as Map),
      revision:row['revision'] as int,
      modifiedAt:DateTime.parse(row['modified_at'] as String))).toList();
  }
  Future<int> queuedCount() async =>
    Sqflite.firstIntValue(await db.rawQuery('SELECT COUNT(*) FROM outbox')) ?? 0;
  Future<SurveyDraft> save(String? existingId, Map<String,dynamic> answers) async {
    final id=existingId??const Uuid().v4();
    final now=DateTime.now().toUtc();
    var revision=1;
    await db.transaction((tx) async {
      final previous=await tx.query('surveys',columns:['revision'],where:'id=?',whereArgs:[id],limit:1);
      if(previous.isNotEmpty)revision=(previous.first['revision'] as int)+1;
      await tx.insert('surveys', {
        'id':id,'answers':jsonEncode(answers),'revision':revision,'modified_at':now.toIso8601String()
      },conflictAlgorithm:ConflictAlgorithm.replace);
      final eventId=id+':'+revision.toString();
      await tx.insert('outbox',{
        'survey_id':id,'revision':revision,'event_id':eventId,
        'payload':jsonEncode({'event_id':eventId,'survey_id':id,'revision':revision,'answers':answers})
      },conflictAlgorithm:ConflictAlgorithm.replace);
    });
    return SurveyDraft(id:id,answers:Map.of(answers),revision:revision,modifiedAt:now);
  }
  // The production sync API is deliberately not enabled yet.
  // A late server acknowledgement must not erase a newer locally queued edit.
  Future<void> acknowledge(String surveyId,String eventId) async {
    await db.delete('outbox',where:'survey_id=? AND event_id=?',whereArgs:[surveyId,eventId]);
  }
}
