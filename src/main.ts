import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { createAppConfig } from './app/app.config';
import { loadAppConfig } from './app/core/config/app-config';

/**
 * Runtime config is fetched before bootstrap so the same artifact can be
 * deployed with or without a Supabase backend.
 */
loadAppConfig()
  .then((config) => bootstrapApplication(App, createAppConfig(config)))
  .catch((error: unknown) => console.error(error));
