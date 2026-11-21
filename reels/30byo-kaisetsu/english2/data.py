"""英語「間違えやすい表現」E29〜E56 の台本データ（出典：Cambridge Dictionary, English Grammar Today）。"""
import json
from pathlib import Path

G = "https://dictionary.cambridge.org/grammar/british-grammar/"
CTA = {"say": "今日の例文を、声に出して言ってみてください。",
       "head": "やってみよう", "lines": [["今日の例文を", 0], ["声に出して言ってみる", 1]]}
WC = "word-choice-"

D = [
("E29", "lose と miss", WC + "lose-or-miss", "Word choice: lose or miss", [
 ("授業に出られない、をルーズと言っていませんか。", "lose と miss", [["授業を逃す", 0], ["lose？ miss？", 1]]),
 ("ミスは、出来事や電車、機会など、起きることを逃すときに使います。", "miss", [["出来事・電車・機会を", 0], ["逃す", 1]]),
 ("ルーズは、ふつう、物をなくすときに使います。", "lose", [["物を", 0], ["なくす", 1]]),
 ("例えば、アイ・ドゥー・ノット・ウォント・トゥー・ミス・マイ・クラス。授業を休みたくない。アイブ・ロスト・マイ・アンブレラ。傘をなくした。", "例文", [["I don't want to", 0], ["miss my class.", 1], ["", 0], ["I've lost", 0], ["my umbrella.", 1]])],
 ["miss：出来事、電車、機会などを逃す", "lose：ふつう物をなくす", "I do not want to miss my class. ／ I've lost my umbrella."]),
("E30", "learn / teach / study", WC + "learn-teach-or-study", "Word choice: learn, teach or study", [
 ("学ぶ、教える、勉強する、英語で言い分けられますか。", "learn / teach / study", [["学ぶ・教える・勉強する", 0], ["言い分けられる？", 1]]),
 ("ラーンは、新しい知識や技術を身につけること。ティーチは、人に教えることです。", "learn と teach", [["learn", 1], ["身につける", 0], ["teach", 1], ["人に教える", 0]]),
 ("スタディは、授業に出たり本を読んだりして、理解しようとすることです。", "study", [["理解しようと", 0], ["勉強する", 1]]),
 ("例えば、マイ・ダッド・トート・ミー・ハウ・トゥー・ドライブ。父が運転を教えてくれた。ラーント・ミー、とは言いません。", "例文", [["My dad taught me", 1], ["how to drive.", 0], ["", 0], ["learnt me ×", 0]])],
 ["learn：新しい知識や技術を身につける", "teach：人に教える／study：授業や本で理解しようと勉強する", "My dad taught me how to drive.（learnt me とは言わない）"]),
("E31", "meet と visit", WC + "meet-or-visit", "Word choice: meet or visit", [
 ("パリに行った、をミート・パリと言っていませんか。", "meet と visit", [["場所に会う？", 0], ["meet？ visit？", 1]]),
 ("ミートは、人に会うときに使います。場所や物には使いません。", "meet", [["人に", 0], ["会う", 1]]),
 ("ビジットは、人や場所、物を訪ねるときに使います。人の場合は、その人がいる所へ行くことです。", "visit", [["人・場所・物を", 0], ["訪ねる", 1]]),
 ("例えば、ウィー・ビジテッド・パリス・アンド・ジ・エッフェル・タワー。パリとエッフェル塔を訪れた。", "例文", [["We visited Paris", 1], ["and the Eiffel Tower.", 0], ["", 0], ["パリとエッフェル塔を訪れた", 0]])],
 ["meet：人に会う（場所や物には使わない）", "visit：人・場所・物を訪ねる", "We visited Paris and the Eiffel Tower."]),
("E32", "travel / trip / journey", WC + "travel-trip-or-journey", "Word choice: travel, trip or journey", [
 ("旅行、を全部トラベルと言っていませんか。", "travel / trip / journey", [["「旅行」は", 0], ["全部 travel？", 1]]),
 ("トラベルは数えられない名詞で、旅行すること全般を指します。", "travel", [["旅行すること", 0], ["全般", 1]]),
 ("行って帰ってくる1回の旅はトリップ。乗り物で移動している部分はジャーニーです。", "trip と journey", [["trip", 1], ["行って帰る1回の旅", 0], ["journey", 1], ["乗り物での移動", 0]]),
 ("例えば、アイ・メット・ヒム・オン・ア・リーセント・トリップ・トゥー・ロンドン。最近のロンドン旅行で彼に会った。", "例文", [["I met him on a recent", 0], ["trip to London.", 1], ["", 0], ["最近のロンドン旅行で", 0], ["彼に会った", 0]])],
 ["travel：旅行すること全般（数えられない）", "trip：行って帰ってくる1回の旅／journey：乗り物で移動している部分", "I met him on a recent trip to London."]),
("E33", "wish と hope", WC + "wish-or-hope", "Word choice: wish or hope", [
 ("試験に受かりますように、をウィッシュと言っていませんか。", "wish と hope", [["「〜しますように」", 0], ["wish？ hope？", 1]]),
 ("これから起きてほしいことを言うときは、ホープを使います。", "未来への願い", [["hope", 1]]),
 ("ウィッシュの後に動詞が続くときは、現在形や未来形にしません。", "wish の後の動詞", [["現在形・未来形に", 0], ["しない", 1]]),
 ("例えば、アイ・ホープ・アイ・ウィル・パス・オール・マイ・イグザムズ。全部の試験に受かりますように。", "例文", [["I hope I will pass", 1], ["all my exams.", 0], ["", 0], ["I wish I will pass ×", 0]])],
 ["未来に起きてほしいことは hope", "wish の後の動詞は現在形・未来形にしない（I wish we could …）", "I hope I will pass all my exams."]),
("E34", "win と beat", WC + "win-or-beat", "Word choice: win or beat", [
 ("相手チームに勝った、をウィンと言っていませんか。", "win と beat", [["相手に勝つ", 0], ["win？ beat？", 1]]),
 ("ウィンは、試合や大会に勝つこと。賞を取るときにも使います。", "win", [["試合・大会に", 0], ["勝つ", 1]]),
 ("ビートは、対戦する相手やチームに勝つときに使います。", "beat", [["相手に", 0], ["勝つ", 1]]),
 ("例えば、ウィー・ビート・ボウス・チームズ。両方のチームに勝った。ウィー・ウォン・ボウス・チームズ、とは言いません。", "例文", [["We beat both teams.", 1], ["両方のチームに勝った", 0], ["", 0], ["We won both teams. ×", 0]])],
 ["win：試合や大会に勝つ、賞を取る", "beat：対戦相手に勝つ", "We beat both teams.（We won both teams とは言わない）"]),
("E35", "sometime と sometimes", WC + "sometime-or-sometimes", "Word choice: sometime or sometimes", [
 ("エスがあるかないかで、意味が変わります。", "sometime と sometimes", [["s があるかないかで", 0], ["意味が変わる", 1]]),
 ("サムタイムは、いつか、という意味です。はっきりしない未来や過去の時を指します。", "sometime", [["いつか", 1]]),
 ("サムタイムズは、ときどき、という意味です。", "sometimes", [["ときどき", 1]]),
 ("例えば、サムタイムズ・アイ・プレイ・フットボール・ウィズ・マイ・ファーザー。ときどき父とサッカーをします。", "例文", [["Sometimes I play football", 1], ["with my father.", 0], ["", 0], ["ときどき父とサッカーをする", 0]])],
 ["sometime：いつか", "sometimes：ときどき", "Sometimes I play football with my father. ／ You should come and visit me sometime."]),
("E36", "last と latest", WC + "last-or-latest", "Word choice: last or latest", [
 ("最新の流行、をラストと言っていませんか。", "last と latest", [["「最新の」は", 0], ["last？ latest？", 1]]),
 ("ラストは、この前の、という意味で、ふつう時や出来事に使います。", "last", [["この前の", 1], ["（時・出来事）", 0]]),
 ("いちばん新しく作られたもの、最新のものには、レイテストを使います。", "latest", [["最新の", 1]]),
 ("例えば、シー・オールウェイズ・ウェアーズ・ザ・レイテスト・ファッションズ。彼女はいつも最新の服を着ている。", "例文", [["She always wears", 0], ["the latest fashions.", 1], ["", 0], ["いつも最新の服を着ている", 0]])],
 ["last：この前の（時や出来事）", "latest：最新の", "It was my birthday last Sunday. ／ She always wears the latest fashions."]),
("E37", "trouble と problem", WC + "trouble-or-problem", "Word choice: trouble or problem", [
 ("ア・トラブル、と言っていませんか。", "trouble と problem", [["a trouble", 1], ["と言っていない？", 0]]),
 ("プロブレムは、対処が必要な、困った状況のこと。数えられる名詞です。", "problem", [["数えられる", 1], ["a problem", 0]]),
 ("トラブルは、困りごと全般を指し、ほとんど数えられない名詞です。アは付けません。", "trouble", [["ほとんど数えられない", 1], ["a trouble ×", 0]]),
 ("例えば、アイ・ハッド・トラブル・ウィズ・ザ・カー・ラスト・ナイト。昨夜、車の調子が悪かった。", "例文", [["I had trouble", 1], ["with the car last night.", 0], ["", 0], ["昨夜、車の調子が悪かった", 0]])],
 ["problem：対処が必要な困った状況（数えられる）", "trouble：困りごと全般（ほとんど数えられない、a を付けない）", "I had trouble with the car last night."]),
("E38", "fault と mistake", WC + "fault-or-mistake", "Word choice: fault or mistake", [
 ("間違い、と、責任、英語では違う言葉です。", "fault と mistake", [["間違い と 責任", 0], ["違う言葉", 1]]),
 ("フォルトは、悪いことが起きたとき、誰の責任かを言うときに使います。", "fault", [["誰の", 0], ["責任か", 1]]),
 ("ミステイクは、自分のしたことや考えたことが間違っていたときに使います。", "mistake", [["したこと・考えたことの", 0], ["間違い", 1]]),
 ("例えば、アイ・スティル・メイク・ロッツ・オブ・ミステイクス・イン・マイ・エッセイズ。作文でまだ間違いが多い。", "例文", [["I still make lots of", 0], ["mistakes in my essays.", 1], ["", 0], ["作文でまだ間違いが多い", 0]])],
 ["fault：悪いことが起きたときの責任", "mistake：したこと・考えたことの間違い", "It's my fault that the car was stolen. ／ I still make lots of mistakes in my essays."]),
("E39", "alone と lonely", WC + "alone-or-lonely", "Word choice: alone or lonely", [
 ("一人になりたい、をロンリーと言っていませんか。", "alone と lonely", [["「一人で」は", 0], ["alone？ lonely？", 1]]),
 ("アローンは、ほかの人がいない、一人で、という意味です。", "alone", [["一人で", 1]]),
 ("ロンリーは、一人でいて、寂しいと感じることです。", "lonely", [["寂しい", 1]]),
 ("例えば、サムタイムズ・アイ・ライク・トゥー・ビー・アローン・トゥー・シンク。考えごとをしたくて、一人になりたいときがある。", "例文", [["Sometimes I like to be", 0], ["alone to think.", 1], ["", 0], ["考えたくて", 0], ["一人になりたいときがある", 0]])],
 ["alone：ほかの人がいない、一人で", "lonely：一人で寂しい", "Sometimes I like to be alone to think."]),
("E40", "forget と leave", WC + "forget-or-leave", "Word choice: forget or leave", [
 ("バスに傘を忘れた、をフォゲットと言っていませんか。", "forget と leave", [["〇〇に忘れた", 0], ["forget？ leave？", 1]]),
 ("フォゲットで、持ってくるのを忘れた、と言うときは、置いてきた場所は言いません。", "forget", [["置いてきた場所は", 0], ["言わない", 1]]),
 ("場所を言うときは、リーブを使います。", "場所を言うなら", [["leave", 1], ["＋ 場所", 0]]),
 ("例えば、アイ・レフト・マイ・アンブレラ・オン・ザ・バス。バスに傘を忘れた。", "例文", [["I left my umbrella", 1], ["on the bus.", 0], ["", 0], ["バスに傘を忘れた", 0]])],
 ["forget：置いてきた場所は言わない（I forgot my phone.）", "場所を言うときは leave", "I left my umbrella on the bus."]),
("E41", "gone と been", WC + "go-gone-and-been", "Word choice: go, gone and been", [
 ("ニューヨークに行ったことがある、をゴーンと言っていませんか。", "gone と been", [["「行ったことがある」", 0], ["gone？ been？", 1]]),
 ("ハズ・ゴーン・トゥーは、行ってしまって、まだそこにいる、という意味です。", "has gone to", [["行ってしまった", 1], ["（まだそこにいる）", 0]]),
 ("ハズ・ビーン・トゥーは、行って戻ってきた、訪れたことがある、という意味です。", "has been to", [["行ってきた", 1], ["訪れたことがある", 0]]),
 ("例えば、ハブ・ユー・エバー・ビーン・トゥー・ニューヨーク。ニューヨークに行ったことはありますか。", "例文", [["Have you ever been", 1], ["to New York?", 0], ["", 0], ["ニューヨークに", 0], ["行ったことはある？", 0]])],
 ["has gone to：行ってしまった（まだそこにいる）", "has been to：行ってきた、訪れたことがある", "Have you ever been to New York?"]),
("E42", "tired of と tired from", WC + "tired-of-or-tired-from", "Word choice: tired of or tired from", [
 ("タイアード・オブとタイアード・フロム、意味が違います。", "tired of と tired from", [["tired of", 1], ["tired from", 1], ["意味が違う", 0]]),
 ("タイアード・オブは、うんざりしている、という意味です。", "tired of", [["うんざり", 1]]),
 ("タイアード・フロムは、そのせいで疲れて休みたい、という意味です。", "tired from", [["〜で", 0], ["疲れた", 1]]),
 ("例えば、アイム・タイアード・フロム・ザ・ロング・ジャーニー。長旅で疲れた。", "例文", [["I'm tired from", 1], ["the long journey.", 0], ["", 0], ["長旅で疲れた", 0]])],
 ["tired of：うんざりしている", "tired from：〜で疲れた", "I'm tired from the long journey. ／ I'm tired of hearing his awful jokes."]),
("E43", "think about と think of", WC + "think-about-think-of-or-think", "Word choice: think about, think of or think", [
 ("どう思う、をホワット・ドゥー・ユー・シンク・ザ・カラーと言っていませんか。", "think of / about", [["What do you think", 0], ["the colour? ×", 1]]),
 ("人や物について考える、意見を聞くときは、シンク・アバウトやシンク・オブを使います。", "〜について", [["think about", 1], ["think of", 1]]),
 ("〜しようかと考えている、は、シンキング・オブと動詞のイングの形です。", "〜しようかと考える", [["thinking of", 1], ["＋ 動詞ing", 0]]),
 ("例えば、ウィー・アー・シンキング・オブ・ハビング・ア・パーティー。パーティーを開こうかと考えている。", "例文", [["We are thinking of", 1], ["having a party.", 0], ["", 0], ["パーティーを開こうかと", 0], ["考えている", 0]])],
 ["人や物について考える・意見を聞くときは think about / think of", "「〜しようかと考える」は think of ＋ 動詞ing（thinking to … とは言わない）", "What do you think of the colour? ／ We are thinking of having a party."]),
("E44", "wait と expect", WC + "wait-or-expect", "Word choice: wait or expect", [
 ("待つ、と、期待する、英語では言葉が違います。", "wait と expect", [["待つ と 予想する", 0], ["違う言葉", 1]]),
 ("ウェイトは、人や物が来るまで、その場で待つことです。", "wait", [["来るまで", 0], ["待つ", 1]]),
 ("エクスペクトは、そうなるだろうと思うことです。", "expect", [["そうなるだろうと", 0], ["思う", 1]]),
 ("例えば、シー・エクスペクテッド・トゥー・ドゥー・ウェル・イン・ジ・イグザム。彼女は試験でいい点を取れると思っていた。", "例文", [["She expected to do well", 1], ["in the exam.", 0], ["", 0], ["試験でうまくいくと", 0], ["思っていた", 0]])],
 ["wait：来るまで待つ（I waited twenty minutes for the bus.）", "expect：そうなるだろうと思う", "She expected to do well in the exam."]),
("E45", "join と attend", WC + "join-or-attend", "Word choice: join or attend", [
 ("会議に参加した、をジョインと言っていませんか。", "join と attend", [["会議に参加", 0], ["join？ attend？", 1]]),
 ("ジョインは、団体や組織の一員になることです。", "join", [["一員に", 0], ["なる", 1]]),
 ("会議などの行事に出るときは、アテンド。少し改まった言い方なので、ふだんはゴー・トゥーも使えます。", "行事に出る", [["attend", 1], ["くだけた言い方は go to", 0]]),
 ("例えば、アイ・アテンデッド・ア・カンファレンス。会議に出席した。", "例文", [["I attended", 1], ["a conference.", 0], ["", 0], ["会議に出席した", 0]])],
 ["join：団体や組織の一員になる", "行事に出るときは attend（少し改まった言い方。くだけた場面では go to）", "I attended a conference about global warming."]),
("E46", "know と get to know", WC + "know-or-get-to-know", "Word choice: know or get to know", [
 ("知り合いになる、をノウと言っていませんか。", "know と get to know", [["知り合いになる", 0], ["know？", 1]]),
 ("ノウは、すでによく知っている、という意味です。", "know", [["よく", 0], ["知っている", 1]]),
 ("一緒に過ごして、だんだん相手を知っていくときは、ゲット・トゥー・ノウを使います。", "get to know", [["だんだん", 0], ["知っていく", 1]]),
 ("例えば、ソー・ウィー・クッド・ゲット・トゥー・ノウ・ジ・アザー・スチューデンツ。ほかの学生と知り合えるように。", "例文", [["so we could get to know", 1], ["the other students", 0], ["", 0], ["ほかの学生と知り合えるように", 0]])],
 ["know：すでによく知っている", "get to know：一緒に過ごして知っていく、知り合いになる", "They organized a party so we could get to know the other students."]),
("E47", "until now と so far", WC + "until-now-or-so-far", "Word choice: until now or so far", [
 ("今のところ、をアンティル・ナウと言っていませんか。", "until now と so far", [["「今のところ」は", 0], ["until now？", 1]]),
 ("アンティル・ナウは、今まで続いていたことが、ちょうど終わったときに使います。", "until now", [["今までは", 0], ["（もう終わった）", 1]]),
 ("まだ続いていて、これからも続きそうなときは、ソー・ファーを使います。", "so far", [["今のところ", 1], ["（まだ続いている）", 0]]),
 ("例えば、ザ・ウェザー・ハズ・ビーン・ラブリー・ソー・ファー。今のところ、いい天気が続いている。", "例文", [["The weather has been", 0], ["lovely so far.", 1], ["", 0], ["今のところいい天気", 0]])],
 ["until now：今まで続いていたことが、ちょうど終わったとき", "so far：まだ続いていて、これからも続きそうなとき", "The weather has been lovely so far."]),
("E48", "that と than", WC + "that-or-than", "Word choice: that or than", [
 ("ザットとザン、つづりが似ていて、書き間違えやすい言葉です。", "that と than", [["that", 1], ["than", 1], ["書き間違えやすい", 0]]),
 ("ザットは、アイ・シンク・ザット、のように、文をつなぐときに使います。", "that", [["I think that …", 1], ["文をつなぐ", 0]]),
 ("ザンは、ベター・ザン、のように、比べるときに使います。", "than", [["better than …", 1], ["比べる", 0]]),
 ("例えば、アイ・シンク・ザ・スポーツ・クラブ・イズ・ベター・ザン・ザ・ジム。スポーツクラブのほうがジムより良いと思う。", "例文", [["The sports club is", 0], ["better than the gym.", 1], ["", 0], ["スポーツクラブのほうが", 0], ["ジムより良い", 0]])],
 ["that：I think that … のように文をつなぐ", "than：better than … のように比べる", "I think that it will be fine. ／ I think the sports club is better than the gym."]),
("E49", "good と well", "part-of-speech-good-or-well", "Part of speech: good or well", [
 ("ドイツ語を上手に話す、をグッドと言っていませんか。", "good と well", [["上手に話す", 0], ["good？ well？", 1]]),
 ("グッドは形容詞で、名詞を説明します。", "good", [["形容詞", 1], ["a good cook", 0]]),
 ("ウェルは副詞で、動詞を説明します。", "well", [["副詞", 1], ["cooks well", 0]]),
 ("例えば、アイ・スピーク・ジャーマン・ウェル。ドイツ語を上手に話します。", "例文", [["I speak German well.", 1], ["ドイツ語を上手に話す", 0], ["", 0], ["speak German good ×", 0]])],
 ["good：形容詞。名詞を説明する（a good cook）", "well：副詞。動詞を説明する（cooks well）", "I speak German well."]),
("E50", "easy と easily", "part-of-speech-easy-or-easily", "Part of speech: easy or easily", [
 ("簡単に受かる、をイージーと言っていませんか。", "easy と easily", [["簡単に受かる", 0], ["easy？ easily？", 1]]),
 ("イージーは形容詞で、簡単な、という意味です。ふつう名詞を説明します。", "easy", [["簡単な", 1], ["The exam was easy.", 0]]),
 ("イージリーは副詞で、簡単に、という意味です。ふつう動詞を説明します。", "easily", [["簡単に", 1]]),
 ("例えば、ユー・シュッド・パス・ジ・イグザム・イージリー。きっと簡単に受かりますよ。", "例文", [["You should pass", 0], ["the exam easily.", 1], ["", 0], ["簡単に受かるはず", 0]])],
 ["easy：簡単な（形容詞）", "easily：簡単に（副詞）", "You should pass the exam easily."]),
("E51", "high と tall", "high-or-tall", "High or tall?", [
 ("背が高い、をハイと言っていませんか。", "high と tall", [["背が高い", 0], ["high？ tall？", 1]]),
 ("ハイは、山や、地面から高い所にあるものに使います。人には使いません。", "high", [["山・高い所にあるもの", 0], ["人には使わない", 1]]),
 ("人の背が高いときや、建物や木のように細長く高いものには、トールを使います。", "tall", [["人の背", 1], ["細長く高いもの", 0]]),
 ("例えば、サリー・イズ・ベリー・トール。サリーはとても背が高い。", "例文", [["Sally is very tall.", 1], ["サリーはとても背が高い", 0], ["", 0], ["high mountains", 1], ["高い山", 0]])],
 ["high：山や、地面から高い所にあるもの（人には使わない）", "tall：人の背、建物や木のように細長く高いもの", "Sally is very tall. ／ There are some high mountains in the north."]),
("E52", "ill と sick", "ill-or-sick", "Ill or sick?", [
 ("病気の子ども、をアン・イル・チャイルドと言っていませんか。", "ill と sick", [["病気の子ども", 0], ["an ill child？", 1]]),
 ("イルもシックも、体調が悪い、という意味です。ビーやフィールなどの後には、どちらも使えます。", "ill と sick", [["どちらも", 0], ["体調が悪い", 1]]),
 ("名詞の前には、シックを使います。イルはふつう名詞の前に置きません。", "名詞の前は", [["sick", 1], ["a sick child", 0]]),
 ("例えば、シーズ・ビーン・ルッキング・アフター・ア・シック・チャイルド。彼女は病気の子どもの看病をしている。", "例文", [["looking after", 0], ["a sick child", 1], ["", 0], ["病気の子どもの看病", 0]])],
 ["ill／sick：どちらも体調が悪い（be、feel などの後では両方使える）", "名詞の前は sick（an ill child とはふつう言わない）", "She's been looking after a sick child this week."]),
("E53", "house と home", "house-or-home", "House or home?", [
 ("ハウスとホーム、どちらも家ですが、違いがあります。", "house と home", [["どちらも「家」", 0], ["違いは？", 1]]),
 ("ハウスは、建物としての家を指します。", "house", [["建物", 1]]),
 ("ホームは、自分が暮らす場所を、より身近な気持ちで言う言葉です。ふつう建物そのものは指しません。", "home", [["暮らす場所", 1], ["身近な言い方", 0]]),
 ("例えば、イッツ・ノット・ベリー・ビッグ・バット・イッツ・マイ・ホーム。大きくはないけれど、私の家です。", "例文", [["It's not very big", 0], ["but it's my home.", 1], ["", 0], ["大きくないけど私の家", 0]])],
 ["house：建物としての家", "home：自分が暮らす場所（気持ちのこもった言い方。ふつう建物そのものは指さない）", "It's not very big but it's my home."]),
("E54", "do と make", "do-or-make", "Do or make?", [
 ("宿題をする、はドゥーとメイク、どちらでしょう。", "do と make", [["宿題をする", 0], ["do？ make？", 1]]),
 ("ドゥーは、行うこと、作業そのものに重点があります。", "do", [["行うこと", 1], ["do homework", 0]]),
 ("メイクは、その結果できるもの、作ったものに重点があります。", "make", [["できたもの", 1], ["make a mistake", 0]]),
 ("例えば、ドゥー・ザ・ショッピング、ドゥー・ホームワーク。メイク・コーヒー、メイク・フレンズ。", "例", [["do the shopping", 1], ["do homework", 0], ["make coffee", 1], ["make friends", 0]])],
 ["do：行うこと、作業そのもの（do homework、do the shopping）", "make：結果としてできるもの（make coffee、make friends）", "When I was doing the calculations, I made two mistakes."]),
("E55", "rob と steal", "rob-or-steal", "Rob or steal?", [
 ("財布を盗まれた、をロブと言っていませんか。", "rob と steal", [["財布を盗む", 0], ["rob？ steal？", 1]]),
 ("ロブは、盗まれた場所や人に重点があります。", "rob", [["場所・人", 1], ["から奪う", 0]]),
 ("スティールは、盗まれた物に重点があります。", "steal", [["物", 1], ["を盗む", 0]]),
 ("例えば、ヒー・ストール・マイ・ウォレット。彼に財布を盗まれた。ヒー・ロブド・マイ・ウォレット、とは言いません。", "例文", [["He stole my wallet.", 1], ["財布を盗まれた", 0], ["", 0], ["He robbed my wallet. ×", 0]])],
 ["rob：盗まれた場所や人に重点（rob a bank）", "steal：盗まれた物に重点", "He stole my wallet.（He robbed my wallet とは言わない）"]),
("E56", "raise と rise", "raise-or-rise", "Raise or rise?", [
 ("レイズとライズ、どちらも上がる、上げる、の意味ですが、使い方が違います。", "raise と rise", [["raise", 1], ["rise", 1], ["使い方が違う", 0]]),
 ("レイズは、何かを上げる、という意味で、必ず目的語が付きます。", "raise", [["〜を", 0], ["上げる", 1]]),
 ("ライズは、それ自体が上がる、という意味で、目的語は付きません。", "rise", [["それ自体が", 0], ["上がる", 1]]),
 ("例えば、レイズ・ユア・ハンド。手を挙げて。ザ・サン・ロウズ。太陽がのぼった。", "例文", [["Raise your hand.", 1], ["手を挙げて", 0], ["The sun rose.", 1], ["太陽がのぼった", 0]])],
 ["raise：〜を上げる（目的語が必要。raise, raised, raised）", "rise：それ自体が上がる（目的語なし。rise, rose, risen）", "Raise your hand if you know the answer. ／ The sun rose at 5.30 this morning."]),
]

scripts, caps = [], ["# 英語「間違えやすい表現」E29〜E56 概要欄\n"]
TAGS = "#英語 #英文法 #英会話 #英語学習 #英単語"
for vid, title, slug, stitle, segs, pts in D:
    ss = [dict(say=s, head=h, lines=l) for s, h, l in segs]
    cta = dict(CTA); cta["note"] = f"出典：Cambridge Dictionary\nGrammar「{stitle}」"
    ss.append(cta)
    scripts.append(dict(id=vid, cat="英語｜間違えやすい表現", segs=ss))
    caps.append(f"## {vid} {title}\n```\n【30秒解説】英語の間違えやすい表現：{title}\n\n▼ポイント\n" + "\n".join("・" + p for p in pts)
                + f"\n\n今日の例文を、声に出して言ってみてください。\n\n出典：Cambridge Dictionary Grammar「{stitle}」\n{G}{slug}\n\n音声：VOICEVOX:麒ヶ島宗麟\n\nあとで見返せるように保存しておくと便利です。\n\n{TAGS}\n```\n")
here = Path(__file__).parent
(here / "scripts.json").write_text(json.dumps(scripts, ensure_ascii=False, indent=1), encoding="utf-8")
(here / "captions.md").write_text("\n".join(caps), encoding="utf-8")
print(len(scripts), "scripts")
