import { stdin, stdout } from 'process';
import * as readline from 'readline';
import * as util from 'util';

export class Console {
    private readonly mIn: NodeJS.ReadStream;
    private readonly mOut: NodeJS.WriteStream;

    /**
     * Constructor.
     */
    public constructor() {
        this.mOut = stdout;
        this.mIn = stdin;

        // Set input configurations.
        readline.emitKeypressEvents(this.mIn);
    }

    /**
     * Output banner.
     * @param pName - Banner name
     */
    public banner(pName: string): void {
        const lNameLength: number = pName.length;
        const lFilling: string = new Array(lNameLength).fill('-').join('');

        // Output banner.
        this.writeLine(`// ${lFilling} //`);
        this.writeLine(`// ${pName} //`);
        this.writeLine(`// ${lFilling} //`);
        this.writeLine('');
    }

    /**
     * Clear n lines of output.
     * @param pCount - Count of lines. 
     */
    public clearLines(pCount: number): void {
        this.mOut.moveCursor(0, pCount * -1); // moving two lines up
        this.mOut.cursorTo(0); // then getting cursor at the begining of the line
        this.mOut.clearScreenDown();
    }

    /**
     * Open promt and validate answer.
     * @param pQuestion - Input question. 
     * @param pValidationRegex - Validation for input.
     */
    public async promt(pQuestion: string, pValidationRegex: RegExp): Promise<string> {
        // Initialize readline.
        const lReadLine = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Async.
        const lAnswer = await new Promise<string>((pResolve) => {
            let lInput: string = '';

            lReadLine.question(pQuestion, (pAnswer) => {
                lInput = pAnswer;
                lReadLine.close();
            });

            // Resolve promise on input close.
            lReadLine.on('close', () => {
                pResolve(lInput);
            });
        });

        // Validate answer.
        if (pValidationRegex && !pValidationRegex.test(lAnswer)) {
            // Output error message and retry promt.
            this.writeLine(`Answer musst match ${pValidationRegex.toString()}`);

            // Reopen promt.
            return this.promt(pQuestion, pValidationRegex);
        } else {
            return lAnswer;
        }
    }

    /**
     * Output text.
     * @param pText - Output text. 
     */
    public write(pText: string, pColor?: string): void {
        if (pColor) {
            const lColorCode: [string, string] = <any>util.inspect.colors[pColor];
            const lColoredCode: string = `\x1b[${lColorCode[0]}m${pText}\x1b[${lColorCode[1]}m`;
            this.mOut.write(lColoredCode);
        } else {
            this.mOut.write(pText);
        }
    }

    /**
     * Output text end with newline.
     * @param pText - Output text. 
     */
    public writeLine(pText: string, pColor?: string): void {
        this.write(pText + '\n', pColor);
    }
}