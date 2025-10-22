import { FoundryCatalogError } from '../errors.js';

export class SimilarityError extends FoundryCatalogError {
  constructor(message: string, cause?: Error) {
    super(message, 'similarity', cause);
    this.name = 'SimilarityError';
  }
}
