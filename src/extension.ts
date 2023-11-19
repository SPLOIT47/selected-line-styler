import * as vscode from 'vscode';

let is_active = false;

let selected_color: string;
let selected_alpha: string;

let status_bar_item: vscode.StatusBarItem;

let indentation_decoration_types: vscode.TextEditorDecorationType[] = [];

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  selected_color = context.globalState.get('selected_color', '#ff0000');
  selected_alpha = context.globalState.get('selected_alpha', '0.5');

  status_bar_item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status_bar_item.command = 'extension.toggle';
  status_bar_item.text = 'Line Selection: OFF';
  context.subscriptions.push(status_bar_item);

  const kDisposableStatusBarItem = vscode.commands.registerCommand('extension.toggle', () => {
    is_active = !is_active;

    if (is_active) {
      if (!panel) {
        panel = vscode.window.createWebviewPanel(
          'colorPicker', 
          "Choose a Color", 
          vscode.ViewColumn.One, 
          {
              enableScripts: true,
          }
        );
        
        panel.webview.html = `
        <html>
<head>
<style>
body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
}
input[type=color] {
    border: none;
    width: 60px;
    height: 60px;
    border-radius: 0; // Changed from 30px to 0
    cursor: pointer;
}
input[type=number] {
    width: 60px;
    margin: 1em;
    padding-left: 6px;
}
button {
  background-color: #4CAF50; /* Green */
  border: none;
  color: white;
  padding: 15px 32px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-size: 16px;
  margin: 4px 2px;
  cursor: pointer;
  transition-duration: 0.4s;
}
button:hover {
  background-color: white; 
  color: black; 
  border: 2px solid #4CAF50;
}
</style>
  </head>
<body>
    <input type="color" id="picker" name="favcolor" value="#ff0000">
    <input type="number" id="alpha" name="alpha" min="0" max="1" step="0.1" value="0.5">
    <button onclick="sendColor()">Apply</button>

    <script type="text/javascript" charset="utf-8">
        // Handle messaging
        function sendColor() {
            const picker = document.getElementById('picker');
            const alpha = document.getElementById('alpha');
            const color = picker.value;
            const a = alpha.value;
            
            window.acquireVsCodeApi().postMessage({
                command: 'changeColor',
                color: color,
                alpha: a
            });
        }
    </script>
</body>
</html>`;

    
        panel.webview.onDidReceiveMessage(
          message => {
            switch (message.command) {
              case 'changeColor':
                selected_color = message.color;
                selected_alpha = message.alpha;
                context.globalState.update('selected_color', selected_color);
                context.globalState.update('selected_alpha', selected_alpha);
                return;
    
              default:
                vscode.window.showErrorMessage('Unknown command');
                return;
            }
          },
          undefined,
          context.subscriptions
        );
      } else {
        panel.reveal();
      }
      
      status_bar_item.text = 'Line Selection: ON';
      vscode.window.showInformationMessage('Extension enabled');
    } else {
      status_bar_item.text = 'Line Selection: OFF';
      vscode.window.showInformationMessage('Extension disabled');
      
      // Очищение декораций
      indentation_decoration_types.forEach(type => {
        if (vscode.window.activeTextEditor) {
          vscode.window.activeTextEditor.setDecorations(type, []); 
        }
        type.dispose();
      });
      indentation_decoration_types = [];
    }
  });

  context.subscriptions.push(kDisposableStatusBarItem);
    
  status_bar_item.show();

  const disposable = vscode.window.onDidChangeTextEditorSelection(UpdateIndentHighlighting);

  context.subscriptions.push(disposable);
}

export function deActivate() {
  if(status_bar_item) {
    status_bar_item.dispose();
  }
  indentation_decoration_types.forEach(type => {
    if(vscode.window.activeTextEditor) {
      vscode.window.activeTextEditor.setDecorations(type, []); 
    }
    type.dispose();
  });
  if(panel) {
    panel.dispose();
  }
}

function UpdateIndentHighlighting(event: vscode.TextEditorSelectionChangeEvent) {
  if (is_active) {
    const editor = event.textEditor;
    const selection = event.selections[0];
    if (editor && selection) {
      const line = editor.document.lineAt(selection.active.line);

      indentation_decoration_types.forEach(type => {
        if(editor) {
          editor.setDecorations(type, []);
        }
        type.dispose(); 
      });

      indentation_decoration_types = [];

      let new_indentation_decoration_type;
      if (selected_color) {
        let rgb = HexToRgb(selected_color);
        if (rgb === null) {
            vscode.window.showErrorMessage('Invalid color hex string');
            return;
        }
  
        new_indentation_decoration_type = vscode.window.createTextEditorDecorationType({
          backgroundColor: `rgba(${rgb.r},${rgb.g},${rgb.b},${selected_alpha})`
        });
      } else {
        new_indentation_decoration_type = vscode.window.createTextEditorDecorationType({
          backgroundColor: 'rgba(84, 92, 92, 0.5)',  
        });
      }

      indentation_decoration_types.push(new_indentation_decoration_type);

      const fullLineRange = new vscode.Range(
        line.lineNumber,
        0,
        line.lineNumber,
        line.text.length
      );

      editor.setDecorations(new_indentation_decoration_type, [fullLineRange]);
    }
  }
}

function HexToRgb(hex:string) {
  let result;
  if (hex.length === 4) {
    result = /^#([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
    if (result) {
        return {
            r: parseInt(result[1]+result[1], 16),
            g: parseInt(result[2]+result[2], 16),
            b: parseInt(result[3]+result[3], 16)
        }
    }
  } else if (hex.length === 7) {
    result = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        }
    }
  }
  return null;
}
