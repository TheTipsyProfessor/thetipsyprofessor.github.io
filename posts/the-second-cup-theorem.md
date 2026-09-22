---
title: A Proof That the Best Coffee Is Always the Second Cup
dek: Rigorous in form, indefensible in substance, and correct. A short paper for anyone who has ever been disappointed by a cup they had been looking forward to.
place: Zürich
time: 07:52
date: 2026-07-19
tangent: Habits
pours: 2
image: assets/img/plate-coffee.webp
imageAlt: Ink and wash drawing of a bearded man in a cream field jacket, standing and drinking from a paper cup.
keywords: coffee, habit, mathematics, proof, mornings, anticipation, zurich
---

The first cup is not coffee. The first cup is a repair. You are not drinking it, you are restoring yourself to the condition in which drinking is possible, and nobody has ever enjoyed a repair.

The third cup is a mistake with a known end date. We will return to it.

This leaves the second, and I intend to prove --- in the weak sense in which anything can be proved before eight in the morning --- that it is the only one that counts.^[A colleague once objected that this argument is unfalsifiable. I pointed out that it was seven in the morning and he had not yet had his second cup, so his testimony was inadmissible. He has not forgiven me and he was completely right.]

![A man in a cream field jacket, drinking from a paper cup, standing against nothing in particular.](assets/img/plate-coffee.webp "The author, mid-repair. Note the absence of enjoyment."){wide 1086x1448}

## Definitions

Let $n \in \mathbb{N}$ index the cups of a single morning. For each cup define:

- $D(n)$ --- the **deficit**: how far you are from baseline before cup $n$. $D(1)$ is large. $D(n)$ decreases.
- $A(n)$ --- the **anticipation**: how much you wanted it. This is not the same thing as need.
- $C(n)$ --- the **capacity to notice**: whether you are in any condition to taste what you are drinking.

Pleasure, $P$, is not a function of the coffee. It is a function of those three.

::: aside
You will observe that the coffee itself does not appear anywhere in this paper. This is not an oversight. It is the finding.
:::

## The model

Deficit falls off roughly geometrically; you fix most of the problem with the first cup and progressively less thereafter.

$$
D(n) = D_0\,\alpha^{\,n-1}, \qquad 0 < \alpha < 1
$$

Capacity to notice is the complement of deficit --- you cannot taste anything while you are still broken --- but it decays at the far end too, once caffeine has made you brisk and inattentive:

$$
C(n) = \bigl(1 - \alpha^{\,n-1}\bigr)\,e^{-\lambda (n-1)}
$$

And pleasure is anticipation gated by the capacity to receive it:

$$
P(n) = A(n)\,C(n)
$$

## The result

Take $A(n)$ as roughly constant across the first few cups --- you want them all about equally, which is the honest empirical position --- and maximise $P$.

$$
\frac{dP}{dn} = 0
\quad\Longrightarrow\quad
n^{\star} = 1 + \frac{1}{\ln(1/\alpha)}\,\ln\!\left(1 + \frac{\ln(1/\alpha)}{\lambda}\right)
$$

For any plausible morning --- $\alpha \approx 0.4$, $\lambda \approx 0.35$ --- this gives $n^{\star} \approx 2.0$.

::: pull
The second cup is the only one you are both awake enough to taste and still hungry enough to want.
:::

$\blacksquare$

## Objections

**"You chose the parameters to get the answer."**
Yes. This is standard practice and I have at least admitted it.^[The defensible version of this paper would fit the parameters to data. I have the data --- eleven years of it, in notebooks --- and I have declined to look, on the grounds that I prefer the result.]

**"What about the third cup?"**
The third cup is $P(3) < P(2)$ under every parameterisation I have tried, and yet I drink it daily. The model does not predict behaviour. It predicts satisfaction, and the entire interest of the thing is that the two come apart.

**"This is not mathematics."**
Correct. It is a grievance wearing a lab coat. But look at what it caught: the best moment of a habit is almost never the moment the habit exists to produce. You do not keep a habit for its peak. You keep it for the repair, and you get the peak by accident, once, on the way past.

> Anticipation and capacity move in opposite directions. Everything good is the brief overlap.

That is true of coffee. I have been unable to find anything it is not true of, and I have been looking since Tuesday.
