export type FieldType = 'text' | 'number' | 'select' | 'multi' | 'gps' | 'photo';
export type SurveyField = { key: string; label: string; type: FieldType; options?: string[]; required?: boolean };
export type SurveySection = { name: string; fields: SurveyField[] };
const f = (key: string, label: string, type: FieldType = 'text', options?: string[], required = false): SurveyField =>
  ({ key, label, type, options, required });
const yesNo = ['Yes', 'No'];
const grade = ['Good', 'Moderate', 'Bad'];
export const provinces = ['Masvingo','Manicaland','Midlands','Mashonaland East','Mashonaland West','Mashonaland Central','Matabeleland South','Matabeleland North'];

export const sections: SurveySection[] = [
  { name: 'Scheme demographics', fields: [
    f('site_name','Site name','text',undefined,true), f('scheme_name','Irrigation scheme name','text',undefined,true),
    f('scheme_photo','Photograph of irrigation scheme','photo',undefined,true),
    f('province','Province','select',provinces,true), f('district','District','text',undefined,true), f('ward','Ward'),
    f('scheme_gps','Scheme location (preferably at gate)','gps'),
    f('officer_name','Contributing officer name'), f('officer_designation','Designation'),
    f('officer_phone','Phone number'), f('officer_email','Email address'),
  ]},
  { name: 'Technical characteristics', fields: [
    f('equipped_area_ha','Total equipped area (ha)','number'), f('expansion_area_ha','Potential expansion area (ha)','number'),
    f('functional_area_ha','Total functional area (ha)','number'),
    f('water_source_type','Water source type','select',['River','Dam','Borehole','Treated wastewater','Spring','Well','Disused mine shafts','Other']),
    f('water_source_name','Water source name'), f('water_source_photo','Water source photo','photo'),
    f('water_source_gps','Water source coordinates','gps'), f('beneficiaries','Number of beneficiaries','number'),
    f('plot_size_ha','Plot size per beneficiary (ha)','number'), f('blocking_system','Blocking system','select',yesNo),
    f('commissioned_year','Year of commissioning','number'),
    f('scheme_status','Current scheme status','select',['Fully functional','Partially functional','Under Construction','Under rehabilitation','Non-functional']),
    f('irrigation_system','Irrigation system','select',['Gravity-fed sprinkler','Pumped sprinkler','Piped surface','Gravity-fed canals','Drip','Pivots','Drag hose','Hose reel','Other']),
    f('irrigation_system_photo','Irrigation system photo','photo'),
    f('energy_source','Energy source','select',['Solar','Electricity','Diesel/petrol','Gravity','Other']),
    f('sector_type','Sector type','select',['Communal','A1','A2','Estates','Individual','Commercial','Other']),
    f('management_model','Management model','select',['Farmer / IMC','Cooperative','ARDA','Other']),
  ]},
  { name: 'Infrastructure condition', fields: [
    f('headworks_condition','Headworks condition','select',grade), f('headworks_photo','Headworks photo','photo'),
    f('conveyance_condition','Conveyance line condition','select',grade),
    f('conveyance_photo','Conveyance photo','photo'), f('storage_available','Storage facilities present','select',yesNo),
    f('storage_condition','Storage facility condition','select',grade), f('storage_photo','Storage facility photo','photo'),
    f('infield_condition','Infield infrastructure condition','select',grade), f('infield_photo','Infield infrastructure photo','photo'),
    f('fence_condition','Perimeter fence condition','select',grade), f('fence_photo','Fence photo','photo'),
    f('road_condition','Access road condition','select',['Good','Moderate','Poor / Bad']),
    f('network_condition','Mobile network access','select',['Good','Moderate','Poor / Bad']),
    f('network_provider','Mobile network providers','multi',['Econet','NetOne','Telecel','Other']),
  ]},
  { name: 'Operation and maintenance', fields: [
    f('maintenance_responsible','Who performs routine maintenance?','select',['Farmers','Government of Zimbabwe','NGOs','Other']),
    f('maintenance_manual','O&M manual available','select',yesNo), f('maintenance_fund','Farmers O&M fund','select',yesNo),
    f('government_levy','Government O&M levy paid','select',yesNo), f('rehabilitation_count','Times rehabilitated','number'),
    f('last_rehabilitation','Last rehabilitation date / year'), f('rehabilitated_by','Who carried out rehabilitation?'),
  ]},
  { name: 'Water management', fields: [
    f('water_year_round','Sufficient irrigation water all year','select',yesNo),
    f('water_committee','Water management committee','select',yesNo),
    f('uniform_equipment','Uniform nozzles, siphons or sprinklers','select',yesNo),
    f('uniform_equipment_comment','Equipment comments'),
    f('irrigation_schedule','Consistent irrigation schedule','select',yesNo),
    f('saving_mechanisms','Water saving mechanisms','select',yesNo), f('saving_photo','Water saving mechanisms photo','photo'),
    f('drainage','Functional drainage structures','select',yesNo),
    f('waterlogging','Signs of waterlogging','select',yesNo), f('waterlogging_photo','Waterlogging photo','photo'),
  ]},
  { name: 'Weather monitoring', fields: [
    f('weather_station','Weather station available','select',yesNo),
    f('weather_station_photo','Weather station photo','photo'),
    f('weather_station_gps','Weather station location','gps'),
    f('weather_instruments','Weather station instruments','multi',['Rain gauge','Cup anemometer','Wind vane','Barometer','Thermometer','Hygrometer','Lightning detector','Pyranometer','Other']),
    f('weather_records','Weather components recorded','multi',['Rainfall','Temperature','Wind speed','Wind direction','Other']),
  ]},
  { name: 'Agronomy and markets', fields: [
    f('major_crops','Major crops grown','multi',['Green mealies','Grain maize','Wheat','Potatoes','Butternuts','Tomatoes','Onions','Chilli','Sugar beans','Chomolia','Other']),
    f('similar_crops','Farmers grow similar crops','select',yesNo),
    f('markets','Major markets for produce'), f('market_analysis','Market analysis before planting','select',yesNo),
  ]},
  { name: 'Sustainability challenges', fields: [
    f('challenges','Challenges experienced','multi',['Unsustainable plot sizes','Unreliable water delivery','Deteriorating infrastructure','Limited O&M capacity','Scheme ownership confusion','Lack of irrigation policy','Difficulty accessing finance','Low farmer commitment','Unsustainable development approaches','Political interference','Other']),
    f('challenge_notes','Other challenges and remarks'),
  ]},
];
export const allFields = sections.flatMap(section => section.fields);
export const schemaVersion = 1;
