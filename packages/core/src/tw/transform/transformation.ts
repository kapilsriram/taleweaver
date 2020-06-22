import { ICursorService } from '../cursor/service';
import { ILayoutService } from '../layout/service';
import { IChange, IChangeResult } from '../model/change/change';
import { IMapping } from '../model/change/mapping';
import { IModelService } from '../model/service';
import { IRenderService } from '../render/service';

export interface ITransformation {
    apply(
        modelService: IModelService,
        cursorService: ICursorService,
        renderService: IRenderService,
        layoutService: ILayoutService,
    ): ITransformationResult;
}

export interface ITransformationResult {
    readonly transformation: ITransformation;
    readonly changeResults: IChangeResult[];
    readonly reverseTransformation: ITransformation;
}

export class Transformation implements ITransformation {
    constructor(
        protected changes: IChange[],
        protected modelCursorHead?: number,
        protected modelCursorAnchor?: number,
        protected keepLeftLock = false,
    ) {}

    apply(
        modelService: IModelService,
        cursorService: ICursorService,
        renderService: IRenderService,
        layoutService: ILayoutService,
    ): ITransformationResult {
        let originalCursorModelAnchor: number | undefined = undefined;
        let originalCursorModelHead: number | undefined = undefined;
        if (cursorService.hasCursor()) {
            const { anchor, head } = cursorService.getCursor();
            originalCursorModelAnchor = renderService.convertOffsetToModelOffset(anchor);
            originalCursorModelHead = renderService.convertOffsetToModelOffset(head);
        }
        const changeResults = this.applyChanges(modelService);
        if (cursorService.hasCursor()) {
            if (this.modelCursorHead !== undefined) {
                const cursorHead = renderService.convertModelOffsetToOffset(
                    this.boundModelOffset(this.modelCursorHead, modelService),
                );
                let cursorAnchor = cursorHead;
                if (this.modelCursorAnchor !== undefined) {
                    cursorAnchor = renderService.convertModelOffsetToOffset(
                        this.boundModelOffset(this.modelCursorAnchor, modelService),
                    );
                }
                cursorService.setCursor(cursorAnchor, cursorHead);
            }
            if (!this.keepLeftLock) {
                const { node: line, offset: lineOffset } = layoutService
                    .resolvePosition(cursorService.getCursor().head)
                    .atLineDepth();
                cursorService.setLeftLock(line.resolveBoundingBoxes(lineOffset, lineOffset).boundingBoxes[0].left);
            }
        }
        const reverseChanges: IChange[] = [];
        const reverseMappings: IMapping[] = [];
        for (let n = changeResults.length - 1; n >= 0; n--) {
            const changeResult = changeResults[n];
            reverseChanges.push(
                reverseMappings.reduce(
                    (reverseChange, reverseMapping) => reverseChange.map(reverseMapping),
                    changeResult.reverseChange,
                ),
            );
            reverseMappings.push(changeResult.mapping.reverse());
        }
        return new TransformationResult(
            this,
            changeResults,
            new Transformation(reverseChanges, originalCursorModelHead, originalCursorModelAnchor, this.keepLeftLock),
        );
    }

    protected applyChanges(modelService: IModelService) {
        const changeResults: IChangeResult[] = [];
        const mappings: IMapping[] = [];
        let changes = [...this.changes];
        while (changes.length > 0) {
            const change = changes.shift()!;
            const changeResult = modelService.applyChange(change);
            const mapping = changeResult.mapping;
            mappings.push(mapping);
            changes = changes.map((c) => c.map(mapping));
            changeResults.push(changeResult);
        }
        return changeResults;
    }

    protected boundModelOffset(offset: number, modelService: IModelService) {
        return Math.max(0, Math.min(modelService.getRootSize() - 1, offset));
    }
}

export class TransformationResult implements ITransformationResult {
    constructor(
        readonly transformation: ITransformation,
        readonly changeResults: IChangeResult[],
        readonly reverseTransformation: ITransformation,
    ) {}
}