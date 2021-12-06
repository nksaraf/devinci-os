// import log from "./ololog"
class Grid {
  rows = [];
  width = 0;
  height = 0;

  chars = {
    active: ['┌', '─', '┒', '┃', '┛', '━', '┕', '│'],
    inactive: ['┌', '─', '┐', '│', '┘', '─', '└', '│'],
    root: ['┌', '╌', '┐', '╎', '┘', '╌', '└', '╎'],
  };

  setSize(width, height) {
    this.rows = Array.from(Array(height)).map(() =>
      Array.from(Array(width)).map(() => ({ char: ' ', node: undefined })),
    );
  }

  insert(char, col, row, node) {
    if (this.rows[row] === undefined) this.rows[row] = [];
    this.rows[row][col] = { char, node };
  }

  drawRect(x, y, width, height, style, node) {
    let i;
    const chars = this.chars[style];
    this.insert(chars[0], x, y, node);
    this.insert(chars[2], x + width, y, node);
    this.insert(chars[4], x + width, y + height, node);
    this.insert(chars[6], x, y + height, node);
    for (i = 1; i < width; i++) {
      this.insert(chars[1], x + i, y, node);
      this.insert(chars[5], x + i, y + height, node);
    }
    for (i = 1; i < height; i++) {
      this.insert(chars[7], x, y + i, node);
      this.insert(chars[3], x + width, y + i, node);
    }
  }

  drawText(text, x, y, node) {
    for (let i = 0; i < text.length; i++) {
      this.insert(text[i], x + i, y, node);
    }
  }

  drawNode(node: TNode) {
    const { left: x, top: y, width, height, type, state, name } = node;
    const style = type === 'root' ? 'root' : state.active ? 'active' : 'inactive';
    if (node.hasChildren) {
      this.drawRect(x, y, width, height, style, node);
      this.insert(' ', x + 1, y, node);
      this.insert(' ', x + name.length + 2, y, node);
      this.drawText(name, x + 2, y, node);
    } else {
      this.drawText(name, x, y, node);
    }

    for (let child of node.childStates) {
      this.drawNode(child);
    }
  }

  render(label: string) {
    // console.clear();
    let styles = [];

    console.log(
      this.rows
        .map((row) =>
          row
            .map((cell) =>
              cell
                ? cell.node?.state.active
                  ? // ? // ? `\x1b[0;37m${cell.char}\x1b[0m`
                    styles.push('color: darkblue;') && `%c${cell.char}`
                  : styles.push('color: lightgray;') && `%c${cell.char}`
                : ' ',
            )
            .join(''),
        )
        .join('\n') +
        label +
        '\n',
      ...styles,
    );
  }

  init(node: TNode, label: string) {
    node.moveTo(0, 0);
    this.setSize(node.width, node.height);
    this.drawNode(node);
    this.render(label);
  }
}

const grid = new Grid();

class TNode {
  left = 0;
  top = 0;
  childStates: TNode[];
  name: string;
  state: StateTreeNode;
  parent: TNode;

  constructor(state: StateTreeNode, parent?: any) {
    this.state = state;
    this.name = state.name;
    this.parent = parent;
    this.childStates = Object.values(state.states).map((s) => new TNode(s, this));
  }

  get right() {
    return this.left + this.width;
  }

  get bottom() {
    return this.top + this.height;
  }

  get width() {
    if (!this.hasChildren) {
      return this.name.length;
    }

    let right = Math.max(this.left + this.name.length + 5, ...this.childStates.map((c) => c.right));

    if (this.childStates.find((c) => c.type === 'branch')) right++;

    right++;

    return right - this.left;
  }

  get height() {
    if (!this.hasChildren) {
      return 1;
    }

    let bottom = Math.max(...this.childStates.map((c) => c.bottom));
    if (bottom > this.top + 2) bottom++;

    return bottom - this.top;
  }

  get hasChildren() {
    return this.childStates.length > 0;
  }

  get type() {
    if (!this.parent) return 'root';
    if (this.childStates.length === 0) return 'leaf';
    return 'branch';
  }

  moveTo(left, top) {
    this.left = left;
    this.top = top;

    let offsetX = 0;
    let maxHeight = 0;
    let offsetY = 1;

    for (let i = 0; i < this.childStates.length; i++) {
      const child = this.childStates[i];

      child.moveTo(left + 2 + offsetX, top + offsetY);

      maxHeight = Math.max(maxHeight, child.height + (child.type === 'leaf' ? 0 : 1));

      if (offsetX < 1 && child.type === 'branch') {
        offsetX += child.width + 2;
        // (child.type === "leaf" ? 1 : 2)
      } else {
        offsetX = 0;
        offsetY += maxHeight;
      }
    }
  }
}

export function renderState(state, label) {
  const tree = new TNode(state.stateTree);
  grid.init(tree, label);
}
