import 'package:flutter_test/flutter_test.dart';
import 'package:nimis_field_collector/survey_schema.dart';

void main(){
  test('survey sections and field keys are unique',(){
    expect(surveySections.length,8);
    final keys=surveySections.expand((s)=>s.fields.map((f)=>f.key)).toList();
    expect(keys.length,greaterThan(60));
    expect(keys.toSet().length,keys.length);
    for(final key in ['scheme_name','province','scheme_gps','water_source_gps',
      'functional_area_ha','scheme_status','major_crops','challenges']){
      expect(keys,contains(key));
    }
  });
  test('eight Zimbabwe provinces configured',()=>expect(provinces.length,8));
}
