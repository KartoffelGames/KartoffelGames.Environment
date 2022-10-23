/*
                // Read file text.
                const lFileText = filereader.readFileSync(lDestinationItem, { encoding: 'utf8' });

                // Replace each replacement pattern.
                let lAlteredFileText = lFileText;
                for (const [lReplacementRegex, lReplacementValue] of pReplacementMap) {
                    lAlteredFileText = lAlteredFileText.replace(lReplacementRegex, lReplacementValue);
                }

                // Update file with altered file text.
                filereader.writeFileSync(lDestinationItem, lAlteredFileText, { encoding: 'utf8' });





                // Copy all files from blueprint folder.
        const lReplacementMap: Map<RegExp, string> = new Map<RegExp, string>();
        lReplacementMap.set(/{{PROJECT_NAME}}/g, lProjectName);
        lReplacementMap.set(/{{PACKAGE_NAME}}/g, lPackageName);
        lReplacementMap.set(/{{PROJECT_FOLDER}}/g, lProjectFolder);
        FileUtil.copyDirectory(lBlueprintPath, lPackagePath, false, lReplacementMap, []);
         */