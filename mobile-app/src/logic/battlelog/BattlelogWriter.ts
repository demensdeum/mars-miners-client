import { BattlelogWriterDelegate } from './BattlelogWriterDelegate';

export abstract class BattlelogWriter {
    protected delegate: BattlelogWriterDelegate;

    constructor(delegate: BattlelogWriterDelegate) {
        this.delegate = delegate;
    }
}
