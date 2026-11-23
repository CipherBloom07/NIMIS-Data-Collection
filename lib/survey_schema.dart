/// Irrigation Schemes Survey Questionnaire (mWater, 11-page reference).
/// Items are grouped for field capture; local keys are stable for future migration.
enum SurveyInput { text, number, choice, multi, gps, photo, date }
class SurveyField {
  const SurveyField(this.key, this.label, this.input, {this.options = const [], this.required = false});
  final String key;
  final String label;
  final SurveyInput input;
  final List<String> options;
  final bool required;
}
class SurveySection {
  const SurveySection(this.title, this.fields);
  final String title;
  final List<SurveyField> fields;
}
const provinces = <String>['Masvingo','Manicaland','Midlands','Mashonaland East','Mashonaland West','Mashonaland Central','Matabeleland South','Matabeleland North'];
const conditions = <String>['Good','Moderate','Bad'];
const yesNo = <String>['Yes','No'];
const surveySections = <SurveySection>[
  SurveySection('Scheme demographics', [
    SurveyField('site_name','Site name',SurveyInput.text),
    SurveyField('scheme_name','Irrigation scheme name',SurveyInput.text,required:true),
    SurveyField('scheme_photo','Irrigation scheme photograph',SurveyInput.photo),
    SurveyField('province','Province',SurveyInput.choice,options:provinces,required:true),
    SurveyField('district','District',SurveyInput.text,required:true),
    SurveyField('ward','Ward',SurveyInput.text),
    SurveyField('scheme_gps','Irrigation scheme location (preferably gate)',SurveyInput.gps),
    SurveyField('officer_name','Contributing officer name',SurveyInput.text),
    SurveyField('officer_designation','Officer designation',SurveyInput.text),
    SurveyField('officer_phone','Officer phone number',SurveyInput.text),
    SurveyField('officer_email','Officer email address',SurveyInput.text),
  ]),
  SurveySection('Technical characteristics', [
    SurveyField('equipped_area_ha','Total equipped area (ha)',SurveyInput.number),
    SurveyField('expansion_area_ha','Potential expansion area (ha)',SurveyInput.number),
    SurveyField('functional_area_ha','Total functional area (ha)',SurveyInput.number),
    SurveyField('water_source_type','Water source type',SurveyInput.choice,options:['River','Dam','Borehole','Treated wastewater','Spring','Well','Disused mine shafts','Other']),
    SurveyField('water_source_name','Name of water source',SurveyInput.text),
    SurveyField('water_source_photo','Water source photograph',SurveyInput.photo),
    SurveyField('water_source_gps','Water source GPS',SurveyInput.gps),
    SurveyField('beneficiaries','Number of beneficiaries',SurveyInput.number),
    SurveyField('plot_size_ha','Plot size per beneficiary (ha)',SurveyInput.number),
    SurveyField('blocking_system','Blocking system?',SurveyInput.choice,options:yesNo),
    SurveyField('commissioned_year','Year of commissioning',SurveyInput.number),
    SurveyField('scheme_status','Current scheme status',SurveyInput.choice,options:['Fully functional','Partially functional','Under Construction','Under rehabilitation','Non-functional']),
    SurveyField('irrigation_system','Irrigation system',SurveyInput.choice,options:['Gravity-fed sprinkler','Pumped sprinkler','Piped surface','Gravity-fed canals','Drip','Pivots','Drag hose','Hose reel','Other']),
    SurveyField('irrigation_system_photo','Irrigation system photograph',SurveyInput.photo),
    SurveyField('energy_source','Energy source',SurveyInput.choice,options:['Solar','Electricity','Diesel/petrol','Gravity','Other']),
    SurveyField('sector_type','Sector type',SurveyInput.choice,options:['Communal','A1','A2','Estates','Individual','Commercial','Other']),
    SurveyField('management_model','Management model',SurveyInput.choice,options:['Farmer/IMC','Cooperative','ARDA','Other']),
  ]),
  SurveySection('Infrastructure condition', [
    SurveyField('headworks_condition','Headworks condition',SurveyInput.choice,options:conditions),
    SurveyField('headworks_photo','Headworks photograph',SurveyInput.photo),
    SurveyField('conveyance_condition','Conveyance line condition',SurveyInput.choice,options:conditions),
    SurveyField('conveyance_photo','Conveyance line photograph',SurveyInput.photo),
    SurveyField('storage_available','Storage facilities present?',SurveyInput.choice,options:yesNo),
    SurveyField('storage_condition','Water storage condition',SurveyInput.choice,options:conditions),
    SurveyField('storage_photo','Water storage photograph',SurveyInput.photo),
    SurveyField('infield_condition','Infield infrastructure condition',SurveyInput.choice,options:conditions),
    SurveyField('infield_photo','Infield infrastructure photograph',SurveyInput.photo),
    SurveyField('fence_condition','Perimeter fence condition',SurveyInput.choice,options:conditions),
    SurveyField('fence_photo','Perimeter fence photograph',SurveyInput.photo),
    SurveyField('road_condition','Access road condition',SurveyInput.choice,options:['Good','Moderate','Poor/Bad']),
    SurveyField('network_condition','Mobile network access',SurveyInput.choice,options:['Good','Moderate','Poor/Bad']),
    SurveyField('network_provider','Accessible mobile networks',SurveyInput.multi,options:['Econet','Netone','Telecel','Other']),
  ]),
  SurveySection('Operation and maintenance', [
    SurveyField('maintenance_responsible','Routine maintenance responsibility',SurveyInput.choice,options:['Farmers','Government of Zimbabwe','NGOs','Other']),
    SurveyField('maintenance_manual','O&M manual available?',SurveyInput.choice,options:yesNo),
    SurveyField('maintenance_fund','Farmer O&M fund?',SurveyInput.choice,options:yesNo),
    SurveyField('government_levy','Government O&M levy paid?',SurveyInput.choice,options:yesNo),
    SurveyField('rehabilitation_count','Times rehabilitated',SurveyInput.number),
    SurveyField('last_rehabilitation','Most recent rehabilitation year/date',SurveyInput.text),
    SurveyField('rehabilitated_by','Rehabilitation responsible party',SurveyInput.text),
  ]),
  SurveySection('Water management', [
    SurveyField('water_year_round','Sufficient water all year?',SurveyInput.choice,options:yesNo),
    SurveyField('water_committee','Irrigation water management committee?',SurveyInput.choice,options:yesNo),
    SurveyField('uniform_equipment','Uniform nozzles/siphons/sprinklers/drippers?',SurveyInput.choice,options:yesNo),
    SurveyField('uniform_equipment_comment','Uniform equipment comments',SurveyInput.text),
    SurveyField('irrigation_schedule','Consistent irrigation schedule?',SurveyInput.choice,options:yesNo),
    SurveyField('saving_mechanisms','Water-saving mechanisms?',SurveyInput.choice,options:yesNo),
    SurveyField('saving_photo','Water-saving mechanisms photograph',SurveyInput.photo),
    SurveyField('drainage','Functional drainage structures?',SurveyInput.choice,options:yesNo),
    SurveyField('waterlogging','Signs of waterlogging?',SurveyInput.choice,options:yesNo),
    SurveyField('waterlogging_photo','Waterlogged area photograph',SurveyInput.photo),
  ]),
  SurveySection('Weather monitoring', [
    SurveyField('weather_station','Weather station present?',SurveyInput.choice,options:yesNo),
    SurveyField('weather_station_photo','Weather station photograph',SurveyInput.photo),
    SurveyField('weather_station_gps','Weather station GPS',SurveyInput.gps),
    SurveyField('weather_instruments','Weather station instruments',SurveyInput.multi,options:['Rain gauge','Cup anemometer','Wind vane','Barometer','Thermometer','Hygrometer','Lightning detector','Pyranometer','Other']),
    SurveyField('weather_records','Weather components recorded',SurveyInput.multi,options:['Rainfall','Temperature','Wind speed','Wind direction','Other']),
  ]),
  SurveySection('Agronomic practices and markets', [
    SurveyField('major_crops','Major crops grown',SurveyInput.multi,options:['Green mealies','Grain maize','Wheat','Potatoes','Butternuts','Tomatoes','Onions','Chilly','Sugar beans','Chomolia','Other']),
    SurveyField('similar_crops','Farmers grow similar crops?',SurveyInput.choice,options:yesNo),
    SurveyField('markets','Major market for produce',SurveyInput.text),
    SurveyField('market_analysis','Market analysis before cropping?',SurveyInput.choice,options:yesNo),
  ]),
  SurveySection('Sustainability challenges', [
    SurveyField('challenges','Major challenges',SurveyInput.multi,options:['Unsustainable plot sizes','Unreliable water delivery','Deteriorating infrastructure','Limited O&M capacity','Confusion on scheme ownership','Lack of irrigation policy','Difficulty accessing finance','Low farmer commitment','Unsustainable development approaches','Political interference','Other']),
    SurveyField('challenge_notes','Other challenges and field notes',SurveyInput.text),
  ]),
];
