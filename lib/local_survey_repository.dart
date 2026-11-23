import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

class SurveyDraft {
  const SurveyDraft({
    required this.id,
    required this.values,
    required this.revision,
    required this.updatedAt,
  });

  final String id;
  final Map<String, dynamic> values;
  final int revision;
  final DateTime updatedAt;

  String get displayName {
    final name = values['scheme_name']?.toString().trim() ?? '';
    return name.isEmpty ? 'Unnamed scheme' : name;
  }
}

class LocalSurveyRepository {
  LocalSurveyRepository._(this.database);

  final Database database;

  static Future<LocalSurveyRepository> open() async {
    final root = await getDatabasesPath();
    final database = await openDatabase(
      p.join(root, 'nimis_surveys_v2.db'),
      version: 1,
      onCreate: (db, version) async {
        await db.execute(
          'CREATE TABLE survey_drafts ('
          'id TEXT PRIMARY KEY, values_json TEXT NOT NULL, '
          'revision INTEGER NOT NULL, updated_at TEXT NOT NULL)',
        );
        await db.execute(
          'CREATE TABLE sync_outbox ('
          'survey_id TEXT PRIMARY KEY, event_id TEXT NOT NULL, '
          'revision INTEGER NOT NULL, payload_json TEXT NOT NULL)',
        );
      },
    );
    return LocalSurveyRepository._(database);
  }

  Future<List<SurveyDraft>> loadDrafts() async {
    final rows = await database.query(
      'survey_drafts',
      orderBy: 'updated_at DESC',
    );
    return rows.map((row) {
      return SurveyDraft(
        id: row['id']! as String,
        revision: row['revision']! as int,
        updatedAt: DateTime.parse(row['updated_at']! as String),
        values: Map<String, dynamic>.from(
          jsonDecode(row['values_json']! as String) as Map,
        ),
      );
    }).toList();
  }

  Future<SurveyDraft> save({
    required Map<String, dynamic> values,
    String? id,
  }) async {
    final draftId = id ?? const Uuid().v4();
    final updatedAt = DateTime.now().toUtc();
    var revision = 1;

    await database.transaction((transaction) async {
      final previous = await transaction.query(
        'survey_drafts',
        columns: ['revision'],
        where: 'id = ?',
        whereArgs: [draftId],
        limit: 1,
      );
      if (previous.isNotEmpty) {
        revision = (previous.single['revision']! as int) + 1;
      }

      await transaction.insert(
        'survey_drafts',
        {
          'id': draftId,
          'values_json': jsonEncode(values),
          'revision': revision,
          'updated_at': updatedAt.toIso8601String(),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );

      final eventId = '$draftId:$revision';
      await transaction.insert(
        'sync_outbox',
        {
          'survey_id': draftId,
          'event_id': eventId,
          'revision': revision,
          'payload_json': jsonEncode({
            'event_id': eventId,
            'survey_id': draftId,
            'revision': revision,
            'updated_at': updatedAt.toIso8601String(),
            'answers': values,
          }),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    });

    return SurveyDraft(
      id: draftId,
      values: Map<String, dynamic>.from(values),
      revision: revision,
      updatedAt: updatedAt,
    );
  }

  Future<int> pendingCount() async {
    final result = await database.rawQuery(
      'SELECT COUNT(*) FROM sync_outbox',
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  // For a future server adapter; never delete a newer unsent revision.
  Future<bool> acknowledge({
    required String surveyId,
    required String eventId,
  }) async {
    final deleted = await database.delete(
      'sync_outbox',
      where: 'survey_id = ? AND event_id = ?',
      whereArgs: [surveyId, eventId],
    );
    return deleted == 1;
  }

  Future<void> close() => database.close();
}
