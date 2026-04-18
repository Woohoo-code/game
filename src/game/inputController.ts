export type MoveDirection = "up" | "down" | "left" | "right";

class InputController {
  private pressed = new Set<MoveDirection>();

  setPressed(direction: MoveDirection, value: boolean): void {
    if (value) {
      this.pressed.add(direction);
      return;
    }
    this.pressed.delete(direction);
  }

  isPressed(direction: MoveDirection): boolean {
    return this.pressed.has(direction);
  }

  clear(): void {
    this.pressed.clear();
  }
}

export const inputController = new InputController();
