export interface FunctionParams {
  name: string;
  owner?: string;
  description: string;
  /** Optional live description (e.g. include saved Chowdeck address). */
  getDescription?: () => string;
  parameters: any;
  handler: (args: any) => Promise<any>;
}