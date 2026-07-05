export interface ApiResponseBody<T = any> {
  statusCode: number;
  message: string;
  data: T | null;
  success: boolean;
}

class ApiResponse<T = any> implements ApiResponseBody<T> {
  statusCode: number;
  message: string;
  data: T | null;
  success: boolean;
  [key: string]: any;

  constructor(statusCode: number, arg2: T | string | null, arg3?: T | string | null) {
    this.statusCode = statusCode;
    this.success = statusCode >= 200 && statusCode < 300;

    if (typeof arg2 === 'string') {
      this.message = arg2;
      this.data = (arg3 ?? null) as T | null;
    } else {
      this.data = (arg2 ?? null) as T | null;
      this.message = typeof arg3 === 'string' ? arg3 : '';
    }

    // To maintain backward compatibility with the frontend client,
    // we flatten the data object's fields directly onto this instance.
    if (this.data && typeof this.data === 'object' && !Array.isArray(this.data)) {
      Object.assign(this, this.data);
    }
  }
}

export { ApiResponse };
export default ApiResponse;
