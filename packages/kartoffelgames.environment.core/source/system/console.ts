export class Console {
    /**
     * Constructor.
     */
    public constructor() { }

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
     * Open promt and validate answer.
     * @param pQuestion - Input question. 
     * @param pValidationRegex - Validation for input.
     */
    public async promt(pQuestion: string, pValidationRegex: RegExp): Promise<string> {
        // Ask user..
        const lAnswer: string = prompt(pQuestion) ?? '';

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
     * Output text end with newline.
     * @param pText - Output text. 
     */
    public writeLine(pText: string, pColor?: string): void {
        if (pColor) {
            // eslint-disable-next-line no-console
            console.log(`%c${pText}`, `color: ${pColor}`);
        } else {
            // eslint-disable-next-line no-console
            console.log(pText);
        }
    }
}