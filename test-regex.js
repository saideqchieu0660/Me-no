const processText = (text) => {
  if (!text) return "";
  let res = text.replace(/\\n|\/n\//gi, '\n');
  res = res.replace(/ +([A-D])\.\s/g, '\n$1. ');
  return res;
};

console.log(processText("Question 8\nHe ______ about his new car all the time.\nA. goes over B. goes on C. goes out D. goes off"));
