import 'package:flutter/material.dart';
import 'local_survey_repository.dart';
import 'media_capture.dart';
import 'survey_schema.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final repository = await LocalSurveyRepository.open();
  runApp(NimisApp(repository: repository));
}

class NimisApp extends StatelessWidget {
  const NimisApp({super.key, required this.repository});
  final LocalSurveyRepository repository;
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'NIMIS Field Collector',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF08738B)),
      scaffoldBackgroundColor: const Color(0xFFF0F7F8),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(), filled: true, fillColor: Colors.white,
      ),
    ),
    home: SurveyHome(repository: repository),
  );
}

class SurveyHome extends StatefulWidget {
  const SurveyHome({super.key, required this.repository});
  final LocalSurveyRepository repository;
  @override
  State<SurveyHome> createState() => _SurveyHomeState();
}

class _SurveyHomeState extends State<SurveyHome> {
  List<SurveyDraft> drafts = [];
  int queued = 0;
  @override
  void initState() { super.initState(); refresh(); }
  Future<void> refresh() async {
    final items = await widget.repository.loadDrafts();
    final count = await widget.repository.pendingCount();
    if (!mounted) return;
    setState(() { drafts = items; queued = count; });
  }
  Future<void> edit(SurveyDraft? draft) async {
    await Navigator.push<void>(context, MaterialPageRoute(
      builder: (_) => SurveyEditor(repository: widget.repository, draft: draft)));
    await refresh();
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('NIMIS Field Collection')),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: () => edit(null), icon: const Icon(Icons.add),
      label: const Text('New survey')),
    body: RefreshIndicator(
      onRefresh: refresh,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Card(child: Padding(padding: const EdgeInsets.all(18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Irrigation Scheme Surveys',
              style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 10),
            Text('Saved: ${drafts.length}  •  Pending upload: $queued'),
            const SizedBox(height: 8),
            const Text('Offline development mode. No surveys are uploaded.',
              style: TextStyle(color: Color(0xFF8E5F13))),
          ]))),
        const SizedBox(height: 12),
        if (drafts.isEmpty) const Padding(
          padding: EdgeInsets.all(24),
          child: Text('No surveys yet. Select New survey to begin.')),
        ...drafts.map((draft) => Card(child: ListTile(
          title: Text(draft.displayName),
          subtitle: Text('${draft.values['province'] ?? 'Province not set'} • Revision ${draft.revision}'),
          trailing: const Icon(Icons.chevron_right), onTap: () => edit(draft)))),
        const SizedBox(height: 100),
      ]),
    ),
  );
}

class SurveyEditor extends StatefulWidget {
  const SurveyEditor({super.key, required this.repository, this.draft});
  final LocalSurveyRepository repository;
  final SurveyDraft? draft;
  @override
  State<SurveyEditor> createState() => _SurveyEditorState();
}

class _SurveyEditorState extends State<SurveyEditor> {
  final media = MediaCapture();
  final controllers = <String, TextEditingController>{};
  late final answers = Map<String, dynamic>.from(widget.draft?.values ?? {});
  int sectionIndex = 0;
  bool saving = false;

  @override
  void dispose() {
    for (final controller in controllers.values) { controller.dispose(); }
    super.dispose();
  }

  void notify(String value) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(value)));
    }
  }

  Future<void> save() async {
    if (saving) return;
    if ((answers['scheme_name']?.toString().trim() ?? '').isEmpty) {
      setState(() => sectionIndex = 0);
      notify('An irrigation scheme name is required.');
      return;
    }
    setState(() => saving = true);
    try {
      await widget.repository.save(id: widget.draft?.id, values: answers);
      if (mounted) { Navigator.pop(context); }
    } catch (error) {
      notify('Could not save: $error');
    } finally {
      if (mounted) { setState(() => saving = false); }
    }
  }

  Future<void> capture(SurveyField field) async {
    try {
      final value = field.input == SurveyInput.gps
          ? await media.getLocation()
          : await media.takePhoto();
      if (value != null && mounted) {
        setState(() => answers[field.key] = value);
      }
    } catch (error) {
      notify('Capture failed: $error');
    }
  }

  Widget inputFor(SurveyField field) {
    final value = answers[field.key];
    switch (field.input) {
      case SurveyInput.text:
      case SurveyInput.number:
      case SurveyInput.date:
        final controller = controllers.putIfAbsent(field.key,
          () => TextEditingController(text: value?.toString() ?? ''));
        return TextField(
          key: ValueKey(field.key), controller: controller,
          decoration: InputDecoration(
            labelText: field.label,
            helperText: field.required ? 'Required' : null),
          keyboardType: field.input == SurveyInput.number
            ? const TextInputType.numberWithOptions(decimal: true)
            : TextInputType.text,
          onChanged: (next) => answers[field.key] = next);
      case SurveyInput.choice:
        return DropdownButtonFormField<String>(
          key: ValueKey(field.key),
          initialValue: value is String && field.options.contains(value)
            ? value : null,
          isExpanded: true, decoration: InputDecoration(labelText: field.label),
          items: field.options.map((option) => DropdownMenuItem(
            value: option, child: Text(option, overflow: TextOverflow.ellipsis))).toList(),
          onChanged: (next) => setState(() => answers[field.key] = next));
      case SurveyInput.multi:
        final selected = value is List
          ? value.map((item) => item.toString()).toSet() : <String>{};
        return ExpansionTile(title: Text(field.label),
          subtitle: Text(selected.isEmpty ? 'Select all that apply' : selected.join(', ')),
          children: field.options.map((option) => CheckboxListTile(
            title: Text(option), value: selected.contains(option),
            onChanged: (checked) => setState(() {
              if (checked == true) { selected.add(option); }
              else { selected.remove(option); }
              answers[field.key] = selected.toList();
            }))).toList());
      case SurveyInput.gps:
      case SurveyInput.photo:
        final captured = value != null;
        return ListTile(
          title: Text(field.label),
          subtitle: Text(captured ? 'Captured locally · Tap to replace' : 'Tap to capture'),
          trailing: Icon(field.input == SurveyInput.gps
            ? Icons.my_location : Icons.camera_alt_outlined),
          onTap: () => capture(field));
    }
  }

  @override
  Widget build(BuildContext context) {
    final section = surveySections[sectionIndex];
    return Scaffold(
      appBar: AppBar(title: Text('Survey ${sectionIndex + 1}/${surveySections.length}')),
      body: SafeArea(child: Column(children: [
        LinearProgressIndicator(value: (sectionIndex + 1) / surveySections.length),
        Padding(padding: const EdgeInsets.all(16),
          child: Text(section.title, style: Theme.of(context).textTheme.titleLarge)),
        Expanded(child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          children: section.fields.map((field) => Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: inputFor(field))).toList())),
        Padding(padding: const EdgeInsets.all(12), child: Row(children: [
          OutlinedButton(
            onPressed: sectionIndex > 0
              ? () => setState(() => sectionIndex--) : null,
            child: const Text('Back')),
          const Spacer(),
          TextButton(onPressed: saving ? null : save, child: const Text('Save draft')),
          FilledButton(
            onPressed: saving ? null : sectionIndex < surveySections.length - 1
              ? () => setState(() => sectionIndex++) : save,
            child: Text(sectionIndex == surveySections.length - 1
              ? 'Finish & Save' : 'Next')),
        ])),
      ])),
    );
  }
}
