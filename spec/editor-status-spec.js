const fs = require("@lumine-code/fs-plus");
const path = require("path");
const os = require("os");

describe("Editor Status", function () {
  let [statusBar, workspaceElement, dummyView] = [];

  beforeEach(async () => {
    workspaceElement = lumine.views.getView(lumine.workspace);
    dummyView = document.createElement("div");
    statusBar = null;

    await lumine.packages.activatePackage("status-bar");
    await lumine.packages.activatePackage("editor-status");

    statusBar = workspaceElement.querySelector("status-bar");
  });

  describe("the file info and editor position tiles", function () {
    let [editor, buffer, fileInfo, editorPosition] = [];

    beforeEach(async () => {
      await lumine.workspace.open("sample.js");

      [fileInfo, editorPosition] = statusBar.getLeftTiles().map((tile) => tile.getItem());
      editor = lumine.workspace.getActiveTextEditor();
      return (buffer = editor.getBuffer());
    });

    describe("when associated with an unsaved buffer", () =>
      it("displays 'untitled' instead of the buffer's path, but still displays the buffer position", async () => {
        await lumine.workspace.open();

        lumine.views.performDocumentUpdate();
        expect(fileInfo.textContent).toBe("untitled");
        expect(editorPosition.textContent).toBe("1:1");
      }));

    describe("when the associated editor's path changes", () =>
      it("updates the path in the status bar", async () => {
        await lumine.workspace.open("sample.txt");

        expect(fileInfo.textContent).toBe("sample.txt");
      }));

    describe("when associated with remote file path", function () {
      beforeEach(function () {
        jasmine.attachToDOM(workspaceElement);
        dummyView.getPath = () => "remote://server:123/folder/remote_file.txt";
        return lumine.workspace.getActivePane().activateItem(dummyView);
      });

      it("updates the path in the status bar", function () {
        // The remote path isn't relativized in the test because no remote directory provider is registered.
        expect(fileInfo.textContent).toBe("remote://server:123/folder/remote_file.txt");
        expect(fileInfo).toBeVisible();
      });

      it("when the path is clicked", function () {
        fileInfo.click();
        expect(lumine.clipboard.read()).toBe("/folder/remote_file.txt");
      });

      it("calls relativize with the remote URL on shift-click", function () {
        const spy = spyOn(lumine.project, "relativize").and.returnValue("remote_file.txt");
        const event = new MouseEvent("click", { shiftKey: true });
        fileInfo.dispatchEvent(event);
        expect(lumine.clipboard.read()).toBe("remote_file.txt");
        expect(spy).toHaveBeenCalledWith("remote://server:123/folder/remote_file.txt");
      });
    });

    describe("when file info tile is clicked", () =>
      it("copies the absolute path into the clipboard if available", async () => {
        await lumine.workspace.open("sample.txt");

        fileInfo.click();
        expect(lumine.clipboard.read()).toBe(fileInfo.getActiveItem().getPath());
      }));

    describe("when the file info tile is shift-clicked", () =>
      it("copies the relative path into the clipboard if available", async () => {
        await lumine.workspace.open("sample.txt");

        const event = new MouseEvent("click", { shiftKey: true });
        fileInfo.dispatchEvent(event);
        expect(lumine.clipboard.read()).toBe("sample.txt");
      }));

    describe("when path of an unsaved buffer is clicked", () =>
      it("copies the 'untitled' into clipboard", async () => {
        await lumine.workspace.open();

        fileInfo.click();
        expect(lumine.clipboard.read()).toBe("untitled");
      }));

    describe("when buffer's path is not clicked", () =>
      it("doesn't display a path tooltip", async () => {
        jasmine.attachToDOM(workspaceElement);
        await lumine.workspace.open();

        expect(document.querySelector(".tooltip")).not.toExist();
      }));

    describe("when buffer's path is clicked", () =>
      it("displays path tooltip and the tooltip disappears after ~2 seconds", async () => {
        jasmine.attachToDOM(workspaceElement);
        await lumine.workspace.open();

        fileInfo.click();
        expect(document.querySelector(".tooltip")).toBeVisible();
        // extra leeway so test won't fail because tooltip disappeared few milliseconds too late
        advanceClock(2100);
        expect(document.querySelector(".tooltip")).not.toExist();
      }));

    describe("when saved buffer's path is clicked", function () {
      it("displays a tooltip containing text 'Copied:' and an absolute native path", async () => {
        jasmine.attachToDOM(workspaceElement);
        await lumine.workspace.open("sample.txt");

        fileInfo.click();
        expect(document.querySelector(".tooltip")).toHaveText(
          `Copied: ${fileInfo.getActiveItem().getPath()}`,
        );
      });

      it("displays a tooltip containing text 'Copied:' for an absolute Unix path", async () => {
        jasmine.attachToDOM(workspaceElement);
        dummyView.getPath = () => "/user/path/for/my/file.txt";
        lumine.workspace.getActivePane().activateItem(dummyView);

        fileInfo.click();
        expect(document.querySelector(".tooltip")).toHaveText(`Copied: ${dummyView.getPath()}`);
      });

      it("displays a tooltip containing text 'Copied:' for an absolute Windows path", async () => {
        jasmine.attachToDOM(workspaceElement);
        dummyView.getPath = () => "c:\\user\\path\\for\\my\\file.txt";
        lumine.workspace.getActivePane().activateItem(dummyView);

        fileInfo.click();
        expect(document.querySelector(".tooltip")).toHaveText(`Copied: ${dummyView.getPath()}`);
      });
    });

    describe("when unsaved buffer's path is clicked", () =>
      it("displays a tooltip containing text 'Copied: untitled", async () => {
        jasmine.attachToDOM(workspaceElement);
        await lumine.workspace.open();

        fileInfo.click();
        expect(document.querySelector(".tooltip")).toHaveText("Copied: untitled");
      }));

    describe("when the associated editor's buffer's content changes", () =>
      it("enables the buffer modified indicator", function () {
        expect(fileInfo.classList.contains("buffer-modified")).toBe(false);
        editor.insertText("\n");
        advanceClock(buffer.stoppedChangingDelay);
        expect(fileInfo.classList.contains("buffer-modified")).toBe(true);
        return editor.backspace();
      }));

    describe("when the buffer content has changed from the content on disk", function () {
      it("disables the buffer modified indicator on save", async () => {
        const filePath = path.join(os.tmpdir(), "lumine-whitespace.txt");
        fs.writeFileSync(filePath, "");

        await lumine.workspace.open(filePath);

        editor = lumine.workspace.getActiveTextEditor();
        expect(fileInfo.classList.contains("buffer-modified")).toBe(false);
        editor.insertText("\n");
        advanceClock(buffer.stoppedChangingDelay);
        expect(fileInfo.classList.contains("buffer-modified")).toBe(true);

        await Promise.resolve(editor.getBuffer().save());

        expect(fileInfo.classList.contains("buffer-modified")).toBe(false);
      });

      it("disables the buffer modified indicator if the content matches again", function () {
        expect(fileInfo.classList.contains("buffer-modified")).toBe(false);
        editor.insertText("\n");
        advanceClock(buffer.stoppedChangingDelay);
        expect(fileInfo.classList.contains("buffer-modified")).toBe(true);
        editor.backspace();
        advanceClock(buffer.stoppedChangingDelay);
        expect(fileInfo.classList.contains("buffer-modified")).toBe(false);
      });

      it("disables the buffer modified indicator when the change is undone", function () {
        expect(fileInfo.classList.contains("buffer-modified")).toBe(false);
        editor.insertText("\n");
        advanceClock(buffer.stoppedChangingDelay);
        expect(fileInfo.classList.contains("buffer-modified")).toBe(true);
        editor.undo();
        advanceClock(buffer.stoppedChangingDelay);
        expect(fileInfo.classList.contains("buffer-modified")).toBe(false);
      });
    });

    describe("when the buffer changes", function () {
      it("updates the buffer modified indicator for the new buffer", async () => {
        expect(fileInfo.classList.contains("buffer-modified")).toBe(false);

        await lumine.workspace.open("sample.txt");

        editor = lumine.workspace.getActiveTextEditor();
        editor.insertText("\n");
        advanceClock(buffer.stoppedChangingDelay);
        expect(fileInfo.classList.contains("buffer-modified")).toBe(true);
      });

      it("doesn't update the buffer modified indicator for the old buffer", async () => {
        const oldBuffer = editor.getBuffer();
        expect(fileInfo.classList.contains("buffer-modified")).toBe(false);

        await lumine.workspace.open("sample.txt");

        oldBuffer.setText("new text");
        advanceClock(buffer.stoppedChangingDelay);
        expect(fileInfo.classList.contains("buffer-modified")).toBe(false);
      });
    });

    describe("when the associated editor's cursor position changes", function () {
      it("updates the cursor position in the status bar", function () {
        jasmine.attachToDOM(workspaceElement);
        editor.setCursorScreenPosition([1, 2]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("2:3");
      });

      it("does not throw an exception if the cursor is moved as the result of the active pane item changing to a non-editor (regression)", async () => {
        await Promise.resolve(lumine.packages.deactivatePackage("editor-status")); // Wrapped so works with Promise & non-Promise deactivate
        lumine.workspace.onDidChangeActivePaneItem(() => editor.setCursorScreenPosition([1, 2]));
        await lumine.packages.activatePackage("editor-status");
        editorPosition = statusBar.getLeftTiles()[1].getItem();

        lumine.workspace.getActivePane().activateItem(document.createElement("div"));
        expect(editor.getCursorScreenPosition()).toEqual([1, 2]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition).toBeHidden();
      });
    });

    describe("when the associated editor's selection changes", function () {
      beforeEach(() => lumine.config.set("editor-status.template", "With Selection and Cursors"));

      it("shows the selection range in the status bar", function () {
        jasmine.attachToDOM(workspaceElement);

        editor.setSelectedBufferRange([
          [0, 0],
          [0, 0],
        ]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("1:1");

        editor.setSelectedBufferRange([
          [0, 0],
          [0, 2],
        ]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("1:1-1:3");

        editor.setSelectedBufferRange([
          [0, 0],
          [1, 30],
        ]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("1:1-2:31");
      });

      it("shows the selection end coordinate even when it lands at the start of a line", function () {
        jasmine.attachToDOM(workspaceElement);
        editor.setSelectedBufferRange([
          [0, 0],
          [1, 0],
        ]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("1:1-2:1");
      });

      it("respects the selection direction (anchor as start, cursor as end)", function () {
        jasmine.attachToDOM(workspaceElement);
        editor.setSelectedBufferRange(
          [
            [0, 0],
            [1, 30],
          ],
          { reversed: true },
        );
        lumine.views.performDocumentUpdate();
        // The cursor sits at the top of a reversed selection, so start is the
        // anchor (bottom) and end is the cursor (top).
        expect(editorPosition.textContent).toBe("2:31-1:1");
      });

      it("appends the cursor count when there is more than one cursor", function () {
        jasmine.attachToDOM(workspaceElement);

        editor.setCursorBufferPosition([0, 0]);
        editor.addCursorAtBufferPosition([1, 2]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("2:3 #2");

        editor.setSelectedBufferRanges([
          [
            [0, 0],
            [0, 1],
          ],
          [
            [1, 0],
            [1, 3],
          ],
        ]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("2:1-2:4 #2");
      });

      it("does not throw an exception if the cursor is moved as the result of the active pane item changing to a non-editor (regression)", async () => {
        await Promise.resolve(lumine.packages.deactivatePackage("editor-status")); // Wrapped so works with Promise & non-Promise deactivate
        lumine.workspace.onDidChangeActivePaneItem(() =>
          editor.setSelectedBufferRange([
            [1, 2],
            [1, 3],
          ]),
        );
        await lumine.packages.activatePackage("editor-status");
        editorPosition = statusBar.getLeftTiles()[1].getItem();

        lumine.workspace.getActivePane().activateItem(document.createElement("div"));
        expect(editor.getSelectedBufferRange()).toEqual([
          [1, 2],
          [1, 3],
        ]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition).toBeHidden();
      });
    });

    describe("when the active pane item does not implement getCursorBufferPosition()", () =>
      it("hides the editor position view", function () {
        jasmine.attachToDOM(workspaceElement);
        lumine.workspace.getActivePane().activateItem(dummyView);
        lumine.views.performDocumentUpdate();
        expect(editorPosition).toBeHidden();
      }));

    describe("when the active pane item implements getTitle() but not getPath()", () =>
      it("displays the title", function () {
        jasmine.attachToDOM(workspaceElement);
        dummyView.getTitle = () => "View Title";
        lumine.workspace.getActivePane().activateItem(dummyView);
        expect(fileInfo.textContent).toBe("View Title");
        expect(fileInfo).toBeVisible();
      }));

    describe("when the active pane item neither getTitle() nor getPath()", () =>
      it("hides the path view", function () {
        jasmine.attachToDOM(workspaceElement);
        lumine.workspace.getActivePane().activateItem(dummyView);
        expect(fileInfo).toBeHidden();
      }));

    describe("when the active pane item's title changes", () =>
      it("updates the path view with the new title", function () {
        jasmine.attachToDOM(workspaceElement);
        const callbacks = [];
        dummyView.onDidChangeTitle = function (fn) {
          callbacks.push(fn);
          return {
            dispose() {},
          };
        };
        dummyView.getTitle = () => "View Title";
        lumine.workspace.getActivePane().activateItem(dummyView);
        expect(fileInfo.textContent).toBe("View Title");
        dummyView.getTitle = () => "New Title";
        for (let callback of Array.from(callbacks)) {
          callback();
        }
        expect(fileInfo.textContent).toBe("New Title");
      }));

    describe("the editor position tile", function () {
      it("renders the selected preset without a selection", function () {
        lumine.config.set("editor-status.template", "Row and Column");
        jasmine.attachToDOM(workspaceElement);
        editor.setCursorScreenPosition([1, 2]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("2:3");
      });

      it("shows the cursor (end) and omits the range for the 'Row and Column' preset", function () {
        lumine.config.set("editor-status.template", "Row and Column");
        jasmine.attachToDOM(workspaceElement);
        editor.setSelectedBufferRange([
          [0, 0],
          [1, 30],
        ]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("2:31");
      });

      it("shows the cursor and selection size for the 'Row and Column, Lines and Chars' preset", function () {
        lumine.config.set("editor-status.template", "Row and Column, Lines and Chars");
        jasmine.attachToDOM(workspaceElement);

        editor.setCursorScreenPosition([1, 2]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("2:3");

        editor.setSelectedBufferRange([
          [0, 0],
          [1, 30],
        ]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("2:31 (2:60)");

        editor.setCursorBufferPosition([0, 0]);
        editor.addCursorAtBufferPosition([1, 2]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("2:3 #2");
      });

      it("shows the range for the 'With Selection' preset", function () {
        lumine.config.set("editor-status.template", "With Selection");
        jasmine.attachToDOM(workspaceElement);
        editor.setSelectedBufferRange([
          [0, 0],
          [1, 30],
        ]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("1:1-2:31");
      });

      it("respects a custom template", function () {
        lumine.config.set("editor-status.template", "Custom");
        lumine.config.set("editor-status.custom", "{{ lines }} lines, {{ chars }} chars");
        jasmine.attachToDOM(workspaceElement);
        editor.setSelectedBufferRange([
          [0, 0],
          [1, 30],
        ]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("2 lines, 60 chars");
      });

      it("updates when the custom template changes", function () {
        lumine.config.set("editor-status.template", "Custom");
        lumine.config.set("editor-status.custom", "L{{ start.row }}");
        jasmine.attachToDOM(workspaceElement);
        editor.setCursorScreenPosition([1, 2]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("L2");

        lumine.config.set("editor-status.custom", "C{{ start.col }}");
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("C3");
      });

      it("supports conditional cursor-count sections in a custom template", function () {
        lumine.config.set("editor-status.template", "Custom");
        lumine.config.set(
          "editor-status.custom",
          "{{ start.row }}{% if n > 1 %} ({{ n }}){% endif %}",
        );
        jasmine.attachToDOM(workspaceElement);

        editor.setCursorBufferPosition([0, 0]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("1");

        editor.addCursorAtBufferPosition([1, 2]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition.textContent).toBe("2 (2)");
      });

      it("hides the tile for the 'Hide' preset", function () {
        lumine.config.set("editor-status.template", "Hide");
        jasmine.attachToDOM(workspaceElement);
        editor.setCursorScreenPosition([1, 2]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition).toBeHidden();
      });

      it("hides the tile when the template renders empty", function () {
        lumine.config.set("editor-status.template", "Custom");
        lumine.config.set("editor-status.custom", "{% if chars %}{{ chars }}{% endif %}");
        jasmine.attachToDOM(workspaceElement);
        editor.setCursorBufferPosition([0, 0]);
        lumine.views.performDocumentUpdate();
        expect(editorPosition).toBeHidden();
      });

      describe("when clicked", () =>
        it("triggers the go-to-line toggle event", function () {
          const eventHandler = jasmine.createSpy("eventHandler");
          lumine.commands.add("lumine-text-editor", "go-to-line:toggle", eventHandler);
          editorPosition.click();
          expect(eventHandler).toHaveBeenCalled();
        }));
    });
  });
});
