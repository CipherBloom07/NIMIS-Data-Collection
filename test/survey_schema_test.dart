import 'package:flutter_test/flutter_test.dart';
import 'package:nimis_field_collector/survey_schema.dart';

void main() {
  test('survey defines eight sections and unique field keys', () {
    expect(surveySections.length, 8);
    final fields = surveySections.expand((section) => section.fields).toList();
    expect(fields.length, 70);
    final keys = fields.map((field) => field.key).toList();
    expect(keys.toSet().length, keys.length);
    expect(keys, contains('scheme_name'));
    expect(keys, contains('water_source_gps'));
    expect(keys, contains('major_crops'));
  });

  test('Zimbabwe provinces are present', () {
    expect(provinces.length, 8);
    expect(provinces, contains('Manicaland'));
    expect(provinces, contains('Masvingo'));
  });
}
