import { ConsoleView } from './components/console/ConsoleView';
import { Header, StatusBar } from './components/Header';
import { HistoryView } from './components/history/HistoryView';
import { ListeningView } from './components/listening/ListeningView';
import { SettingsDialog } from './components/SettingsDialog';
import { TemplatesView } from './components/templates/TemplatesView';
import { Toasts } from './components/Toasts';
import { useRoute } from './lib/router';

export default function App() {
  const route = useRoute();
  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <Header />
      <main className="min-h-0 flex-1 overflow-hidden">
        {route.view === 'console' && <ConsoleView />}
        {route.view === 'listening' && <ListeningView />}
        {route.view === 'templates' && <TemplatesView />}
        {route.view === 'history' && <HistoryView />}
      </main>
      <StatusBar />
      <SettingsDialog />
      <Toasts />
    </div>
  );
}
