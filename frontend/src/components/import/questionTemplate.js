/** Example CSV for question import (prisma QuestionType / QuestionDifficulty). */
export const QUESTION_TEMPLATE_CSV = `type,text,topic,difficulty,marks,options,correct,markingRule,penalty,modelAnswer
SINGLE_CHOICE,What is 2+2?,Arithmetic,EASY,1,2|3|4|5,C,,,
MULTIPLE_SELECT,Select all primes,Number theory,MEDIUM,2,2|3|4|5,A|B,ALL_OR_NOTHING,,
WRITTEN,Explain recursion,Computer science,HARD,5,,,,,A function that calls itself.
`
