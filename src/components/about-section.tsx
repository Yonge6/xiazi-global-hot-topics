import type { AppLocale } from "@/i18n/config";

export function AboutSection({ locale }: { locale: AppLocale }) {
  const isZh = locale === "zh";

  return (
    <section id="about" className="about-section">
      <div className="shell">
        <header>
          <span>{isZh ? "关于我们" : "ABOUT US"}</span>
        </header>

        <div className="about-copy">
          {isZh ? (
            <>
              <p>这个世界每天都很热闹，也很容易把人带跑。</p>
              <p>世界杯进了几个球，AI又进化到了哪一步，谁在谈判，谁在发射火箭，谁又悄悄改写了未来……信息像潮水一样涌来，浪花很大，真正重要的变化却常常藏在水面之下。</p>
              <p>所以，我们做了「虾子曰」。每天00:05，从全球新闻里筛出最新且最值得关注的9件事：先把事实讲清楚，再把门道说明白，配上简短介绍、推荐阅读和可以保存分享的中英文海报。</p>
              <p>我们想用一点烟火气，讲商业、人性与时代变化。不装深刻，不贩焦虑，不带节奏，也不急着替复杂世界下结论。</p>
              <p>虾子曰负责看门道，豆豆龙负责说人话，偶尔补一刀，也始终留一点余地。幽默但不油滑，犀利但不刻薄，达观但不犬儒，通俗但不浅薄。</p>
              <p>有趣是入口，中正是底色，洞察是价值。我们只想讲看得见的人性、想得透的逻辑，以及真正落得下的启发。</p>
              <p className="about-credo">虾子曰：虾说，不瞎说。</p>
              <p>世事如潮，别被浪花带跑。每天看懂9件重要的事，也许就够了。剩下的时间，去工作，去陪家人，去晒太阳，去好好生活。</p>
            </>
          ) : (
            <>
              <p>The world is loud, busy, and very good at pulling us off course.</p>
              <p>World Cup goals, the next leap in AI, negotiations, rocket launches, and quiet decisions that may reshape the future: information arrives like a tide. The splash gets attention, while the changes that matter often move beneath the surface.</p>
              <p>That is why we created Xiazi Says. Every morning at 5:00 Beijing Time, we select the nine stories from the previous day most worth knowing. We explain the facts first, then the meaning, with concise context, recommended reading, and bilingual posters made to save and share.</p>
              <p>We bring everyday warmth to clear-eyed observations about business, human nature, and a changing world. No borrowed profundity, manufactured anxiety, engineered outrage, or rushed verdicts.</p>
              <p>Xiazi looks beneath the surface. Doudoulong speaks plainly and occasionally lands a sharp punchline, always leaving room for complexity. Humorous, never slick. Sharp, never cruel. Optimistic, never cynical. Accessible, never shallow.</p>
              <p>Interest opens the door. Balance sets the tone. Insight creates the value. We focus on visible human nature, sound reasoning, and ideas people can actually carry into life.</p>
              <p className="about-credo">Xiazi Says: Bold talk, never blind talk.</p>
              <p>The world moves like a tide. Do not let the splash carry you away. Nine important stories a day may be enough. Leave the rest of your time for work, family, sunshine, and living well.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
