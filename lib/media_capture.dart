import 'dart:io';

import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

class MediaCapture {
  MediaCapture({ImagePicker? picker})
      : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  Future<String?> takePhoto() async {
    final photo = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 75,
      maxWidth: 1600,
    );
    if (photo == null) return null;
    final documents = await getApplicationDocumentsDirectory();
    final photos = Directory(p.join(documents.path, 'survey_photos'));
    await photos.create(recursive: true);
    final target = p.join(photos.path, '${const Uuid().v4()}.jpg');
    await File(photo.path).copy(target);
    return target;
  }

  Future<Map<String, dynamic>> getLocation() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw StateError('Enable location services to capture GPS.');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw StateError('Location permission was denied.');
    }
    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 25),
      ),
    );
    return {
      'latitude': position.latitude,
      'longitude': position.longitude,
      'accuracy_m': position.accuracy,
      'captured_at': DateTime.now().toUtc().toIso8601String(),
    };
  }
}
