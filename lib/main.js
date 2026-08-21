const { CompositeDisposable, Disposable } = require("lumine");
const FileInfoView = require("./file-info-view");
const EditorPositionView = require("./editor-position-view");

// See the priority convention in packages/status-bar/README.md.
const fileInfoPriority = 310;
const editorPositionPriority = 510;

module.exports = {
  consumeStatusBar(statusBar) {
    this.statusBar = statusBar;

    // `addLeftTile` inserts by priority, so a tile toggled back on returns to
    // its own place rather than to the end of the row.
    this.configSubscriptions = new CompositeDisposable();
    this.configSubscriptions.add(
      lumine.config.observe("item-status.showFileInfo", (visible) =>
        visible ? this.addFileInfo() : this.removeFileInfo(),
      ),
      lumine.config.observe("item-status.showEditorPosition", (visible) =>
        visible ? this.addEditorPosition() : this.removeEditorPosition(),
      ),
    );

    return new Disposable(() => this.teardown());
  },

  deactivate() {
    this.teardown();
  },

  addFileInfo() {
    if (this.fileInfoTile) {
      return;
    }
    this.fileInfo = new FileInfoView();
    this.fileInfoTile = this.statusBar.addLeftTile({
      item: this.fileInfo.element,
      priority: fileInfoPriority,
    });
  },

  removeFileInfo() {
    this.fileInfoTile?.destroy();
    this.fileInfoTile = null;
    this.fileInfo?.destroy();
    this.fileInfo = null;
  },

  addEditorPosition() {
    if (this.editorPositionTile) {
      return;
    }
    this.editorPosition = new EditorPositionView();
    this.editorPositionTile = this.statusBar.addLeftTile({
      item: this.editorPosition.element,
      priority: editorPositionPriority,
    });
  },

  removeEditorPosition() {
    this.editorPositionTile?.destroy();
    this.editorPositionTile = null;
    this.editorPosition?.destroy();
    this.editorPosition = null;
  },

  teardown() {
    this.configSubscriptions?.dispose();
    this.configSubscriptions = null;
    this.removeFileInfo();
    this.removeEditorPosition();
    this.statusBar = null;
  },
};
