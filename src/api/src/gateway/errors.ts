export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} no existe`)
export const forbidden = (why: string) => new HttpError(403, why)
export const badRequest = (why: string) => new HttpError(400, why)
