import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'survey_schema.dart';
import 'survey_store.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final store=await SurveyStore.open();
  runApp(NimisCollector(store:store));
}

class NimisCollector extends StatelessWidget {
  const NimisCollector({super.key,required this.store});
  final SurveyStore store;
  @override Widget build(BuildContext context)=>MaterialApp(
    title:'NIMIS Field Collector',debugShowCheckedModeBanner:false,
    theme:ThemeData(useMaterial3:true,
      colorScheme:ColorScheme.fromSeed(seedColor:const Color(0xFF08768D),secondary:const Color(0xFF158661)),
      scaffoldBackgroundColor:const Color(0xFFEAF5F8),
      inputDecorationTheme:InputDecorationTheme(
        filled:true,fillColor:Colors.white,
        border:OutlineInputBorder(borderRadius:BorderRadius.circular(12)))),
    home:CollectorHome(store:store));
}

class CollectorHome extends StatefulWidget {
  const CollectorHome({super.key,required this.store});
  final SurveyStore store;
  @override State<CollectorHome> createState()=>_CollectorHomeState();
}
class _CollectorHomeState extends State<CollectorHome> {
  List<SurveyDraft> drafts=[];
  int pending=0;
  @override void initState(){super.initState();refresh();}
  Future<void> refresh() async {
    final records=await widget.store.all();
    final queued=await widget.store.queuedCount();
    if(mounted)setState((){drafts=records;pending=queued;});
  }
  Future<void> edit(SurveyDraft? draft)async{
    await Navigator.of(context).push<void>(MaterialPageRoute(
      builder:(_)=>SurveyEditor(store:widget.store,initial:draft)));
    await refresh();
  }
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('NIMIS Field Collector'),actions:[
      IconButton(onPressed:refresh,tooltip:'Refresh',icon:const Icon(Icons.refresh))]),
    floatingActionButton:FloatingActionButton.extended(
      onPressed:()=>edit(null),icon:const Icon(Icons.add),label:const Text('New survey')),
    body:RefreshIndicator(onRefresh:refresh,child:ListView(padding:const EdgeInsets.all(16),children:[
      Card(child:Padding(padding:const EdgeInsets.all(18),child:Column(
        crossAxisAlignment:CrossAxisAlignment.start,children:[
          Text('Irrigation field surveys',style:Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height:8),Text('Saved surveys: '+drafts.length.toString()),
          Text('Pending sync: '+pending.toString()),
          const SizedBox(height:8),
          const Text('Offline mode: surveys are stored on this device. Server sync is not connected.',style:TextStyle(color:Color(0xFF875409))),
        ]))),
      const SizedBox(height:12),
      if(drafts.isEmpty)const Padding(padding:EdgeInsets.all(24),
        child:Text('No saved surveys yet. Start a new field inspection.')),
      ...drafts.map((d)=>Card(child:ListTile(
        title:Text((d.answers['scheme_name'] as String?)?.isNotEmpty==true
          ?d.answers['scheme_name'].toString():'Unnamed scheme'),
        subtitle:Text((d.answers['province']?.toString()??'Province not set')
          +' • Revision '+d.revision.toString()),
        trailing:const Icon(Icons.chevron_right),onTap:()=>edit(d)))),
      const SizedBox(height:100),
    ]))));
}
class SurveyEditor extends StatefulWidget {
  const SurveyEditor({super.key,required this.store,this.initial});
  final SurveyStore store;
  final SurveyDraft? initial;
  @override State<SurveyEditor> createState()=>_SurveyEditorState();
}
class _SurveyEditorState extends State<SurveyEditor> {
  late final Map<String,dynamic> answers=Map<String,dynamic>.from(widget.initial?.answers??{});
  final Map<String,TextEditingController> controllers={};
  int page=0;
  bool saving=false;
  @override void dispose(){
    for(final controller in controllers.values){controller.dispose();}
    super.dispose();
  }
  TextEditingController controller(SurveyField f)=>controllers.putIfAbsent(f.key,
    ()=>TextEditingController(text:answers[f.key]?.toString()??''));
  Future<void> save()async{
    if((answers['scheme_name']?.toString().trim()??'').isEmpty){
      setState(()=>page=0);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Scheme name is required.')));
      return;
    }
    if(saving)return;
    setState(()=>saving=true);
    try{
      await widget.store.save(widget.initial?.id,answers);
      if(mounted)Navigator.of(context).pop();
    }catch(e){
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('Save failed: '+e.toString())));
    }finally{if(mounted)setState(()=>saving=false);}
  }
  Future<void> captureGps(SurveyField f)async{
    try{
      if(!await Geolocator.isLocationServiceEnabled())throw Exception('Enable location services.');
      var permission=await Geolocator.checkPermission();
      if(permission==LocationPermission.denied)permission=await Geolocator.requestPermission();
      if(permission==LocationPermission.denied||permission==LocationPermission.deniedForever)throw Exception('Location permission denied.');
      final position=await Geolocator.getCurrentPosition(
        locationSettings:const LocationSettings(accuracy:LocationAccuracy.high,timeLimit:Duration(seconds:25)));
      if(mounted)setState(()=>answers[f.key]=jsonEncode({
        'latitude':position.latitude,'longitude':position.longitude,
        'accuracy_m':position.accuracy,'captured_at':DateTime.now().toUtc().toIso8601String()}));
    }catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.toString())));}
  }
  Widget drawField(SurveyField f){
    final value=answers[f.key];
    switch(f.input){
      case SurveyInput.text:
      case SurveyInput.number:
      case SurveyInput.date:
        return TextField(key:ValueKey(f.key),controller:controller(f),
          keyboardType:f.input==SurveyInput.number
            ?const TextInputType.numberWithOptions(decimal:true):TextInputType.text,
          decoration:InputDecoration(labelText:f.label),
          onChanged:(s)=>answers[f.key]=s);
      case SurveyInput.choice:
        return DropdownButtonFormField<String>(
          key:ValueKey(f.key),
          initialValue:value is String&&f.options.contains(value)?value:null,
          isExpanded:true,decoration:InputDecoration(labelText:f.label),
          items:f.options.map((v)=>DropdownMenuItem(value:v,child:Text(v,overflow:TextOverflow.ellipsis))).toList(),
          onChanged:(v)=>setState(()=>answers[f.key]=v));
      case SurveyInput.multi:
        final selected=value is List?value.map((v)=>v.toString()).toSet():<String>{};
        return ExpansionTile(key:ValueKey(f.key),title:Text(f.label),
          subtitle:Text(selected.isEmpty?'Select all that apply':selected.join(', ')),
          children:f.options.map((v)=>CheckboxListTile(title:Text(v),
            value:selected.contains(v),onChanged:(checked)=>setState((){
              if(checked==true){selected.add(v);}else{selected.remove(v);}
              answers[f.key]=selected.toList();
            }))).toList());
      case SurveyInput.gps:
        return ListTile(title:Text(f.label),
          subtitle:Text(value?.toString()??'Tap to capture GPS'),
          trailing:const Icon(Icons.my_location),onTap:()=>captureGps(f));
      case SurveyInput.photo:
        return ListTile(title:Text(f.label),
          subtitle:const Text('Camera attachment planned for the next stage'),
          trailing:const Icon(Icons.camera_alt_outlined));
    }
  }
  @override Widget build(BuildContext context){
    final section=surveySections[page];
    return Scaffold(appBar:AppBar(title:Text('Survey • '+(page+1).toString()+'/'+surveySections.length.toString())),
      body:SafeArea(child:Column(children:[
        LinearProgressIndicator(value:(page+1)/surveySections.length),
        Padding(padding:const EdgeInsets.all(16),
          child:Text(section.title,style:Theme.of(context).textTheme.titleLarge)),
        Expanded(child:ListView(padding:const EdgeInsets.symmetric(horizontal:16),
          children:section.fields.map((f)=>Padding(
            padding:const EdgeInsets.only(bottom:16),child:drawField(f))).toList())),
        Padding(padding:const EdgeInsets.all(12),child:Row(children:[
          OutlinedButton(onPressed:page>0?()=>setState(()=>page--):null,child:const Text('Back')),
          const Spacer(),
          TextButton(onPressed:saving?null:save,child:const Text('Save draft')),
          const SizedBox(width:6),
          FilledButton(onPressed:saving?null:page<surveySections.length-1
            ?()=>setState(()=>page++):save,
            child:Text(page==surveySections.length-1?'Finish & Save':'Next')),
        ]))
      ])));
  }
}
