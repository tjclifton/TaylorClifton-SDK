import { createApi } from '..';
import { Book } from './resources/book';
import { Chapter } from './resources/chapter';
import { Character } from './resources/character';
import { Quote } from './resources/quote';

export default createApi({
  /**
   * GET /book(/:id)?
   *
   * Retrieves the list of all books, or one book given its `id`.
   */
  book: {
    resource: Book,
    one: {
      /**
       * GET /book/:book-id/chapter(/:id)?
       *
       * Retrieves the list of all chapters for the given book identified by
       * `book-id`, or one chapter of the specified book by its `id`.
       */
      chapter: Chapter
    },
  },

  /**
   * GET /character(/:id)?
   *
   * Retrieves the list of all characters, or one character given its `id`.
   */
  character: {
    resource: Character,
    one: {
      /**
       * GET /character/:character-id/quote(/:id)?
       *
       * Retrieves the list of all quotes for the given character identified by
       * `character-id`, or one quote from the specified character by its `id`.
       */
      quote: Quote
    }
  },

  /**
   * GET /quote(/:id)?
   *
   * Retrieves the list of all quotes, or one quote given its `id`.
   */
  quote: Quote,

  /**
   * GET /chapter(/:id)?
   *
   * Retrieves the list of all chapters, or one chapter given its `id`.
   */
  chapter: Chapter,
});
