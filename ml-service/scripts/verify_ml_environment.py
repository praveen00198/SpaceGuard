"""
SpaceGuard AI — ML Environment Verification Script

Verifies the isolated Python/ML environment and core dependencies:
- Python version (>= 3.10)
- NumPy
- Pandas
- SciPy
- Scikit-learn & IsolationForest
- Matplotlib
- Seaborn
- Pytest
- FastAPI (ml-service dependency)
"""

import sys
import importlib
from pathlib import Path

# Ensure ml-service root is in sys.path
ml_service_root = Path(__file__).resolve().parent.parent
if str(ml_service_root) not in sys.path:
    sys.path.insert(0, str(ml_service_root))

REQUIRED_PACKAGES = [
    ("numpy", "NumPy"),
    ("pandas", "Pandas"),
    ("scipy", "SciPy"),
    ("sklearn", "Scikit-learn"),
    ("matplotlib", "Matplotlib"),
    ("seaborn", "Seaborn"),
    ("pytest", "Pytest"),
    ("fastapi", "FastAPI"),
]

def check_python_version() -> bool:
    print(f"[1/4] Checking Python Executable & Version:")
    print(f"      Executable : {sys.executable}")
    print(f"      Version    : {sys.version.split()[0]}")
    if sys.version_info < (3, 10):
        print(f"      [FAIL] Python 3.10+ required, found {sys.version.split()[0]}")
        return False
    print(f"      [OK] Python version compatible")
    return True

def check_packages() -> bool:
    print(f"\n[2/4] Checking ML and Service Packages:")
    all_ok = True
    for module_name, display_name in REQUIRED_PACKAGES:
        try:
            mod = importlib.import_module(module_name)
            version = getattr(mod, "__version__", "unknown")
            print(f"      [OK] {display_name:<15} : v{version}")
        except ImportError as e:
            print(f"      [FAIL] {display_name:<15} : Missing ({e})")
            all_ok = False
    return all_ok

def check_isolation_forest() -> bool:
    print(f"\n[3/4] Checking Scikit-learn IsolationForest Import:")
    try:
        from sklearn.ensemble import IsolationForest
        clf = IsolationForest(random_state=42)
        print(f"      [OK] IsolationForest imported and instantiated successfully")
        return True
    except Exception as e:
        print(f"      [FAIL] IsolationForest failed: {e}")
        return False

def check_ml_service_import() -> bool:
    print(f"\n[4/4] Checking ML Service Application Import:")
    try:
        # Verify app can be imported
        import app.main
        print(f"      [OK] ml-service (app.main) imported successfully")
        return True
    except Exception as e:
        print(f"      [WARN/FAIL] Could not import app.main: {e}")
        return False

def main():
    print("=" * 60)
    print("SpaceGuard AI — ML Environment Verification")
    print("=" * 60)
    
    ok1 = check_python_version()
    ok2 = check_packages()
    ok3 = check_isolation_forest()
    ok4 = check_ml_service_import()
    
    print("\n" + "=" * 60)
    if ok1 and ok2 and ok3 and ok4:
        print("VERIFICATION RESULT: ALL CHECKS PASSED")
        print("SpaceGuard AI ML environment is ready for experimentation.")
        print("NOTE: ML MODEL TRAINING HAS NOT STARTED.")
        print("=" * 60)
        sys.exit(0)
    elif ok1 and ok2 and ok3:
        print("VERIFICATION RESULT: CORE ML DEPENDENCIES PASSED")
        print("(ML service import had warnings/errors - check sys.path)")
        print("=" * 60)
        sys.exit(0)
    else:
        print("VERIFICATION RESULT: FAILED")
        print("One or more required packages or checks failed.")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    main()
