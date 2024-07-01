/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ConsolePluginStart } from '@kbn/console-plugin/public';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SearchNotebooksPluginSetup {}

export interface SearchNotebooksPluginStart {
  setNotebookList: (value: NotebookListValue) => void;
}

export interface SearchNotebooksPluginStartDependencies {
  console: ConsolePluginStart;
}

export type NotebookListValue = string | null;
