import type { AppLocale } from "@/i18n/config";
import { PUBLICATION_DISPLAY_TIME } from "@/lib/site/publication-display";

const zhPath = ["认识自己", "接纳自己", "成为自己", "活出自己"];
const enPath = ["Know yourself", "Accept yourself", "Become yourself", "Live as yourself"];

const zhPrinciples = [
  ["一休", "留一点空白，听见内心真正的声音。"],
  ["不二", "不急着分高下，也不把自己困在对错里。"],
  ["三慢", "慢一点看，慢一点想，慢一点成为。"],
  ["如水", "柔软而有方向，随形而不失本心。"],
];

const enPrinciples = [
  ["Rest", "Leave a little space to hear what is true within."],
  ["Non-duality", "Do not rush to rank, divide, or trap life in right and wrong."],
  ["Three Slows", "Look slowly, think slowly, and become slowly."],
  ["Like Water", "Stay soft and directed, adaptable without losing yourself."],
];

export function AboutCopy({ locale, includePhilosophy = false }: { locale: AppLocale; includePhilosophy?: boolean }) {
  const isZh = locale === "zh";
  const timeLabel = PUBLICATION_DISPLAY_TIME;
  const path = isZh ? zhPath : enPath;
  const principles = isZh ? zhPrinciples : enPrinciples;

  return (
    <>
      <div className="about-copy">
        {isZh ? (
          <>
            <p>这个世界每天都很热闹，也很容易把人带跑。</p>
            <p>AI又进化到了哪一步，谁在谈判，谁在发射火箭，谁又悄悄改写了未来……信息像潮水一样涌来，浪花很大，真正重要的变化却常常藏在水面之下。</p>
            <p>所以，我们做了「虾子曰」。每天 {timeLabel}，从全球新闻里筛出最值得关注的 8 件事，再配上 1 张今日总览：先把事实讲清楚，再把门道说明白，配上简短介绍、推荐阅读和可以保存分享的中英文海报。</p>
            <p>我们想用一点烟火气，讲商业、人性与时代变化。不装深刻，不贩焦虑，不带节奏，也不急着替复杂世界下结论。</p>
            <p>虾子曰负责看门道，豆豆龙负责说人话，偶尔补一刀，也始终留一点余地。幽默但不油滑，犀利但不刻薄，达观但不犬儒，通俗但不浅薄。</p>
            <p>有趣是入口，中正是底色，洞察是价值。我们只想讲看得见的人性、想得透的逻辑，以及真正落得下的启发。</p>
            <p className="about-credo">虾子曰：虾说，不瞎说。</p>
            <p>世事如潮，别被浪花带跑。每天看懂世界上最重要的 8 件事，也许就够了。剩下的时间，去工作，去陪家人，去晒太阳，去好好生活。</p>
          </>
        ) : (
          <>
            <p>The world is loud, busy, and very good at pulling us off course.</p>
            <p>The next leap in AI, negotiations, rocket launches, and quiet decisions that may reshape the future: information arrives like a tide. The splash gets attention, while the changes that matter often move beneath the surface.</p>
            <p>Every day at {timeLabel} Beijing time, Xiazi Says selects the 8 global stories that matter most and pairs them with 1 daily overview. We clarify the facts, explain what lies beneath them, and provide concise context, recommended reading, and bilingual posters made to save and share.</p>
            <p>We bring everyday warmth to clear-eyed observations about business, human nature, and a changing world. No borrowed profundity, manufactured anxiety, engineered outrage, or rushed verdicts.</p>
            <p>Xiazi looks beneath the surface. Doudoulong speaks plainly and occasionally lands a sharp punchline, always leaving room for complexity. Humorous, never slick. Sharp, never cruel. Optimistic, never cynical. Accessible, never shallow.</p>
            <p>Interest opens the door. Balance sets the tone. Insight creates the value. We focus on visible human nature, sound reasoning, and ideas people can actually carry into life.</p>
            <p className="about-credo">Xiazi Says: Bold talk, never blind talk.</p>
            <p>The world moves like a tide. Do not let the noise carry you away. Eight important stories a day may be enough. Use the rest of your time to work, be with the people you love, step into the sun, and live well.</p>
          </>
        )}
      </div>

      {includePhilosophy ? (
        <section className="xiazi-life-philosophy">
          <p className="life-kicker">{isZh ? "我们的生命观" : "OUR VIEW OF LIFE"}</p>
          <h3>
            {isZh
              ? "生命不是用来证明自己的，而是用来认识、接纳、成为并活出自己。"
              : "Life is not for proving yourself, but for knowing, accepting, becoming, and living as yourself."}
          </h3>
          <p className="life-intro">
            {isZh
              ? "世界值得看清，自己也值得慢慢读懂。我们相信，真正的成长不是把自己改造成别人，而是更诚实、更松弛地成为本来的自己。"
              : "The world is worth seeing clearly, and the self is worth understanding slowly. Growth is not becoming someone else, but becoming more honestly and gently who you already are."}
          </p>
          <div className="life-path" aria-label={isZh ? "生命路径" : "Life path"}>
            {path.map((item, index) => (
              <span key={item}><i>{String(index + 1).padStart(2, "0")}</i>{item}</span>
            ))}
          </div>
          <div className="life-principles">
            {principles.map(([name, description]) => (
              <article key={name}><strong>{name}</strong><span>{description}</span></article>
            ))}
          </div>
          <blockquote>{isZh ? "向内认识自己，向外如水而行。" : "Know yourself within; move like water through the world."}</blockquote>
          <p className="life-vision">
            {isZh
              ? "愿我们既能看懂时代的潮汐，也能守住自己的节奏；既关心远方发生了什么，也不忘照顾眼前真实的生活。"
              : "May we understand the tides of our time without losing our own rhythm—caring about the wider world while tending to the life directly before us."}
          </p>
        </section>
      ) : null}
    </>
  );
}

export function AboutSection({ locale }: { locale: AppLocale }) {
  const isZh = locale === "zh";

  return (
    <section id="about" className="about-section">
      <div className="shell">
        <header>
          <span>{isZh ? "关于我们" : "ABOUT US"}</span>
        </header>
        <AboutCopy locale={locale} />
      </div>
    </section>
  );
}
