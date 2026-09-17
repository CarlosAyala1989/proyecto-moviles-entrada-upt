import 'package:url_launcher/url_launcher.dart';

abstract interface class AbridorOauth {
  Future<bool> abrir(Uri url);
}

class AbridorOauthExterno implements AbridorOauth {
  const AbridorOauthExterno();

  @override
  Future<bool> abrir(Uri url) {
    return launchUrl(url, mode: LaunchMode.externalApplication);
  }
}
