export interface Fixture {
  name: string;
  input?: string;
  input_bytes?: number[];
  xxh3_128?: string;
  // format fixtures
  algorithm?: string;
  hex?: string;
  expected_formatted?: string;
  formatted?: string;
  expected_algorithm?: string;
  expected_hex?: string;
  // error fixtures
  checksum?: string;
  expected_error?: string;
  error_message_contains?: string[];
}

export interface FixturesFile {
  fixtures: Fixture[];
  format_fixtures?: Fixture[];
  error_fixtures?: Fixture[];
}
