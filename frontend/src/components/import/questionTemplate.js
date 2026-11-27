/** Example CSV for the question import dialog (header + one row per type). */
export const QUESTION_TEMPLATE_CSV = `type,text,topic,difficulty,marks,options,correct,markingRule,penalty,modelAnswer
MCQ_SINGLE,What is 2+2?,Arithmetic,easy,1,2|3|4|5,A,,,
MCQ_MULTI,Select all primes,Number theory,medium,2,2|3|4|5,A|B,ALL_OR_NOTHING,,
WRITTEN,Explain recursion,Computer science,hard,5,,,,,A function that calls itself.
`