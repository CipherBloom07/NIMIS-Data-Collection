import 'dart:io';

import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

/// Camera images returned by image_picker are temporary. Move them to a durable
/// directory owned by this application before storing the path in a survey.
class PhotoStore {
  PhotoStore({ImagePicker? picker}) : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  Future<String?> captureCameraPhoto() async {
    final selected = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 75,
      maxWidth: 1600,
    );
    if (selected == null) return null;

    final root = await getApplicationDocumentsDirectory();
    final targetDir = Directory(p.join(root.path, 'survey_photos'));
    await targetDir.create(recursive: true);

    final fileName = '${const Uuid().v4()}.jpg';
    final source = File(selected.path);
    final targetPath = p.join(targetDir.path, fileName);
    await source.copy(targetPath);
    return targetPath;
  }

  Future<bool> exists(String? localPath) async {
    if (localPath == null || localPath.isEmpty) return false;
    return File(localPath).exists();
  }
}
