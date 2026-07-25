import os, sys
sys.path.insert(0, 'C:\\Users\\meck\\Documents\\madan')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from machines.urls import urlpatterns

print('machines.urls.patterns:')
for i, p in enumerate(urlpatterns):
    print(f'{i}: {p.pattern}')
    if hasattr(p, 'callback') and p.callback:
        print(f'   callback: {type(p.callback).__name__}')
    elif hasattr(p, 'url_patterns'):
        print(f'   (has subpatterns)')
        for j, subp in enumerate(p.url_patterns):
            print(f'   {j}: {subp.pattern}')
            if hasattr(subp, 'callback') and subp.callback:
                print(f'      callback: {type(subp.callback).__name__}')

# Check for the specific URL pattern
for pattern in urlpatterns:
    if pattern.pattern == 'api/reports/':
        print('\nFound api/reports/')
        if hasattr(pattern, 'url_patterns'):
            for subpattern in pattern.url_patterns:
                print(f'  Subpattern: {subpattern.pattern}')
                if 'performance' in str(subpattern.pattern):
                    print('  This is the performance report!')
                    if hasattr(subpattern, 'callback') and subpattern.callback:
                        print(f'  Callback type: {type(subpattern.callback).__name__}')
                        break