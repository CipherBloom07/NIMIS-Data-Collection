import catalogue from '../schemas/form-catalogue.v1.json';
/** Independent client-side preflight; server validation remains authoritative.
 * Drafts with issues can still be saved, but can never be treated as publishable.
 */
export interface CollectionIssue {field:string;message:string}
export function validateRequirementsDraft(
  formId:string,answers:Record<string,unknown>,observedAt:string,source:string,
):CollectionIssue[]{
  const issues:CollectionIssue[]=[];
  if(!source.trim())issues.push({field:'source',message:'Record a source or field observation reference'});
  const date=new Date(observedAt);
  if(!observedAt || !Number.isFinite(date.getTime()) ||
     date.getTime()>Date.now()+24*60*60*1000){
    issues.push({field:'observed_at',message:'Supply a valid observation date, not in the future'});
  }
  const form=catalogue.forms.find(x=>x.form_id===formId);
  if(!form)issues.push({field:'form_id',message:'Unknown collection form version'});
  for(const field of form?.fields??[]){
    const value=answers[field.field_id];
    if(value===undefined||value===null||value==='')continue;
    const type=field.type;
    if(type==='repeating_group'&&(!Array.isArray(value)||
        value.some(x=>!x||typeof x!=='object'||Array.isArray(x)))){
      issues.push({field:field.field_id,message:'A repeating form section must contain structured records'});
    }
    if(type==='group'&&(!value||typeof value!=='object'||Array.isArray(value))){
      issues.push({field:field.field_id,message:'Expected a structured object'});
    }
    if((type==='multi'||type==='reference_list')&&(!Array.isArray(value)||
        value.some(x=>typeof x!=='string'||!x.trim()))){
      issues.push({field:field.field_id,message:'Enter a list of named entries, not raw text'});
    }
    if((type.startsWith('measurement:')||type==='integer')&&
       (typeof value!=='string'&&typeof value!=='number'||
        !Number.isFinite(Number(value))||Number(value)<0||
        (type==='integer'&&!Number.isInteger(Number(value))))){
      issues.push({field:field.field_id,message:'Enter a finite non-negative'+(type==='integer'?' whole number':' measurement')});
    }
    if((type==='photo'||type==='attachments')&&
       (typeof value!=='string'&&!Array.isArray(value))){
      issues.push({field:field.field_id,message:'Photographs must have saved local IDs'});
    }
  }
  for(const [key,value] of Object.entries(answers)){
    if(key.endsWith('_gps')||key==='scheme_gps'){
      if(value!==null && typeof value==='object' && !Array.isArray(value)){
        const point=value as Record<string,unknown>;
        if(typeof point.latitude!=='number'||point.latitude < -90||point.latitude>90||
           typeof point.longitude!=='number'||point.longitude < -180||point.longitude>180||
           typeof point.accuracy_m!=='number'||point.accuracy_m < 0){
          issues.push({field:key,message:'GPS latitude, longitude and accuracy must be valid'});
        }
      }else if(value!=='')issues.push({field:key,message:'GPS location must be captured as coordinates'});
    }
  }
  const keys=['equipped_area_ha','developed_area_ha','functional_area_ha',
    'actually_irrigated_area_ha','planted_area_ha','harvested_area_ha',
    'expansion_area_ha','target_area_ha','substantially_complete_ha',
    'plot_area_ha','storage_percent','progress_percent','beneficiaries'];
  const numeric=(key:string):number|undefined=>{
    const raw=answers[key];
    if(raw===undefined||raw===null||raw==='')return undefined;
    if(typeof raw!=='string'&&typeof raw!=='number'){issues.push({field:key,message:'Expected a numeric measurement'});return undefined;}
    const n=Number(raw);
    if(!Number.isFinite(n)||n<0)issues.push({field:key,message:'Measurement must be a finite non-negative number'});
    return Number.isFinite(n)&&n>=0?n:undefined;
  };
  const values:Record<string,number|undefined>={};
  for(const key of keys)if(key in answers)values[key]=numeric(key);
  const checkLe=(a:string,b:string)=>{
    if(values[a]!==undefined&&values[b]!==undefined&&values[a]!>values[b]!)
      issues.push({field:a,message:a+' cannot exceed '+b});
  };
  checkLe('functional_area_ha','equipped_area_ha');
  checkLe('actually_irrigated_area_ha','equipped_area_ha');
  checkLe('harvested_area_ha','planted_area_ha');
  checkLe('substantially_complete_ha','target_area_ha');
  for(const k of ['storage_percent','progress_percent']){
    if(values[k]!==undefined&&values[k]!>100)issues.push({field:k,message:'Percentage cannot exceed 100'});
  }
  if(formId==='new_scheme_request'&&!answers.scheme_name){
    issues.push({field:'scheme_name',message:'A proposed scheme needs a name'});
  }
  return issues;
}
