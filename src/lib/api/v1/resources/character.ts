/**
 *
 */
export class Character {
  /**
   *
   * @param name the name of the character
   */
  public constructor(
    public readonly name: string,
    public readonly id: number,
    public readonly words: number,
  ) {}
}
