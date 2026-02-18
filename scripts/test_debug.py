import sys
import os
import traceback

output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "debug.txt")

try:
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("Starting test...\n")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    models_dir = os.path.join(project_root, "creating-financial-models")
    sys.path.insert(0, models_dir)

    with open(output_path, 'a', encoding='utf-8') as f:
        f.write(f"Models dir: {models_dir}\n")
        f.write(f"Exists: {os.path.exists(models_dir)}\n")
        f.write(f"Contents: {os.listdir(models_dir)}\n")

    from fcfe_model import FCFEModel
    with open(output_path, 'a', encoding='utf-8') as f:
        f.write("FCFE import OK\n")

    from relative_valuation import RelativeValuation
    with open(output_path, 'a', encoding='utf-8') as f:
        f.write("RV import OK\n")

    from ddm_model import DDMModel
    with open(output_path, 'a', encoding='utf-8') as f:
        f.write("DDM import OK\n")

    # Now try running the main script logic
    sys.path.insert(0, script_dir)
    from run_all_valuations import main
    
    # Redirect stdout to file
    with open(output_path, 'a', encoding='utf-8') as f:
        old_stdout = sys.stdout
        sys.stdout = f
        main()
        sys.stdout = old_stdout

    with open(output_path, 'a', encoding='utf-8') as f:
        f.write("\nALL DONE.\n")

except Exception as e:
    with open(output_path, 'a', encoding='utf-8') as f:
        f.write(f"\nERROR: {e}\n")
        traceback.print_exc(file=f)
