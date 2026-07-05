import { useState } from 'react';
import { CreateStoryModal } from '@/components/CreateStoryModal';
import { useAuth } from '@/hooks/AuthProvider';
import { Button } from '@/components/ui/button';

/**
 * Dev-only route to inspect the CreateStoryModal in isolation.
 * Mounted at /_dev/modal. AuthProvider is at the app root, so we read
 * the current user from there; the modal will fall back to the same shape.
 */
export function DevModalHarnessRoute() {
  const [open, setOpen] = useState(true);
  const { user } = useAuth();

  return (
    <div className="min-h-screen w-full bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">CreateStoryModal Harness</h1>
        <p className="text-sm text-muted-foreground">
          Modal at full open. Author from auth context: <code>{user?.displayName ?? 'guest'}</code>
        </p>
        <div className="flex gap-2">
          <Button onClick={() => setOpen(true)}>Open modal</Button>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </div>
      </div>
      <CreateStoryModal
        open={open}
        onOpenChange={setOpen}
        onSubmit={async () => { /* no-op for harness */ }}
        requestImageCrop={async () => new Blob() }
      />
    </div>
  );
}
