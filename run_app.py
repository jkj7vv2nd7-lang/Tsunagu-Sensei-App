import os
import sys
import streamlit.web.cli as stcli

def resolve_path(relative_path):
    """ PyInstallerでパッケージ化した際の内部リソースパスを解決する関数 """
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

if __name__ == "__main__":
    # app.py の絶対パスを指定
    script_path = resolve_path("app.py")
    
    # Streamlit起動用引数をセット
    sys.argv = ["streamlit", "run", script_path, "--global.developmentMode=false"]
    
    # Streamlitサーバーを実行
    sys.exit(stcli.main())