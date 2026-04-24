import { registerWidget } from '../widget-registry';
import VolumeWidget from './volume-widget';
import LevelsWidget from './levels-widget';
import ServicesWidget from './services-widget';
import HostsWidget from './hosts-widget';
import SourcesWidget from './sources-widget';
import ErrorsWidget from './errors-widget';
import AlertsWidget from './alerts-widget';
import CustomSqlWidget from './custom-sql-widget';
import { WIDGET_METADATA } from '../widget-registry';
import type { WidgetRegistryEntry } from '../types';

const widgets = [
  { type: 'volume', component: VolumeWidget },
  { type: 'levels', component: LevelsWidget },
  { type: 'services', component: ServicesWidget },
  { type: 'hosts', component: HostsWidget },
  { type: 'sources', component: SourcesWidget },
  { type: 'errors', component: ErrorsWidget },
  { type: 'alerts', component: AlertsWidget },
  { type: 'custom_sql', component: CustomSqlWidget },
];

export function initWidgets() {
  widgets.forEach(({ type, component }) => {
    const meta = WIDGET_METADATA[type];
    if (meta) {
      registerWidget({
        type,
        title: meta.title,
        subtitle: meta.subtitle,
        defaultW: meta.defaultW,
        defaultH: meta.defaultH,
        configSchema: meta.configSchema,
        component,
      } as WidgetRegistryEntry);
    }
  });
}
