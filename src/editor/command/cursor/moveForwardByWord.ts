import TaleWeaver from '../../TaleWeaver';
import CursorCommand from '../CursorCommand';
import CursorTransformation from '../../state/CursorTransformation';
import TranslateCursor from '../../state/cursortransformationsteps/TranslateCursor';

export default function moveForwardByWord(): CursorCommand {
  return (taleWeaver: TaleWeaver): CursorTransformation => {
    const transformation = new CursorTransformation();
    const editorCursor = taleWeaver.getState().getEditorCursor();
    if (!editorCursor) {
      return transformation;
    }
    const head = editorCursor.getHead();
    const documentView = taleWeaver.getDocumentView();
    const viewAwarePosition = documentView.resolveModelPosition(head);
    if (viewAwarePosition.wordViewPosition < viewAwarePosition.wordView.getSize()) {
      transformation.addStep(new TranslateCursor(viewAwarePosition.wordView.getSize() - viewAwarePosition.wordViewPosition));
    } else {
      const nextWordView = viewAwarePosition.wordView.getNextWordView();
      if (nextWordView) {
        transformation.addStep(new TranslateCursor(nextWordView.getSize()));
      }
    }
    return transformation;
  };
}