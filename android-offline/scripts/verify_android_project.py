from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
required = [
    root / 'settings.gradle.kts',
    root / 'build.gradle.kts',
    root / 'app' / 'build.gradle.kts',
    root / 'app' / 'src' / 'main' / 'AndroidManifest.xml',
    root / 'app' / 'src' / 'main' / 'java' / 'np' / 'com' / 'laxmannepal' / 'texttohandwriting' / 'MainActivity.kt',
]
missing = [str(p.relative_to(root)) for p in required if not p.exists()]
if missing:
    print('Missing required Android files:')
    print('\n'.join(missing))
    sys.exit(1)

build = (root / 'app' / 'build.gradle.kts').read_text(encoding='utf-8')
for token in ('compileSdk = 36', 'targetSdk = 36', 'applicationId = "np.com.laxmannepal.texttohandwriting"'):
    if token not in build:
        print(f'Missing Android configuration: {token}')
        sys.exit(1)

activity = (root / 'app' / 'src' / 'main' / 'java' / 'np' / 'com' / 'laxmannepal' / 'texttohandwriting' / 'MainActivity.kt').read_text(encoding='utf-8')
for token in ('WebViewAssetLoader', 'appassets.androidplatform.net', 'allowFileAccess = false'):
    if token not in activity:
        print(f'Missing offline/security configuration: {token}')
        sys.exit(1)

print('Android project preflight: PASS')
