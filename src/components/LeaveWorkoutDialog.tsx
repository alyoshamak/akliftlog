import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export default function LeaveWorkoutDialog({
  open,
  onOpenChange,
  onPause,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPause: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Leave this workout?</AlertDialogTitle>
          <AlertDialogDescription>
            Pause it so you can come back, or cancel and discard your progress.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-2 space-y-2">
          <Button
            onClick={() => { onOpenChange(false); onPause(); }}
            className="w-full tap-56 bg-accent text-accent-foreground hover:bg-accent-glow font-bold"
          >
            Pause workout
          </Button>
          <Button
            onClick={() => { onOpenChange(false); onCancel(); }}
            variant="destructive"
            className="w-full tap-56 font-bold"
          >
            Cancel workout
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            variant="ghost"
            className="w-full tap-44"
          >
            Keep training
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
